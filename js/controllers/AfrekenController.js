// ── AfrekenController ─────────────────────────────────────────────────────────
// Toont het huidige saldo + deeplinks naar WhatsApp / Tikkie / bunq / Revolut.
// Bij "Markeer als afgerekend" → registreert een Betaling die het saldo nullt.
import { Utils } from '../core/Utils.js';

const WHATSAPP_TEKST_TEGOED = (bedrag, link) =>
  `Hé! Ik heb nog € ${bedrag} tegoed voor de auto 🚗${link ? ' — ' + link : ''}`;
const WHATSAPP_TEKST_SCHULD = (bedrag) =>
  `Hé! Ik was je nog € ${bedrag} schuldig voor de auto 🚗 — ik maak het over.`;

export class AfrekenController {
  constructor(db) {
    this._db = db;
    this._gebonden = false;
    this._bind();
  }

  openSheet() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) {
      Utils.toast('Selecteer eerst een auto', 'err');
      return;
    }

    const ritten = this._db.getAutoRitten(auto.id) || [];
    const tankbeurten = this._db.getAutoTankbeurten(auto.id) || [];
    const betalingen = this._db.getAutoBetalingen(auto.id) || [];

    const verschuldigd = ritten.reduce((acc, r) => {
      const km = Number(r.km || 0);
      if (!km) return acc;
      if (auto.type === 'elektrisch') {
        const kwh100 = Number(auto.kwh_per_100km || 0);
        const ppk = Number(auto.prijs_per_kwh || 0);
        if (!kwh100 || !ppk) return acc;
        return acc + (km / 100) * kwh100 * ppk;
      }
      const kmpl = Number(auto.km_per_liter || 0);
      const ppl = Number(auto.prijs_per_liter || 0);
      if (!kmpl || !ppl) return acc;
      return acc + (km / kmpl) * ppl;
    }, 0);
    const brandstof = tankbeurten.reduce((acc, t) => acc + Number(t.totaal || 0), 0);
    const ikIs = this._isIk.bind(this);
    const inUit = betalingen.reduce((acc, b) => {
      const bedrag = Number(b.bedrag || 0);
      if (ikIs(b.naar)) return acc - bedrag; // ik kreeg betaald → saldo daalt
      if (ikIs(b.van)) return acc + bedrag;  // ik betaalde → saldo stijgt
      return acc;
    }, 0);

    // saldo > 0 = jij hebt tegoed; saldo < 0 = jij bent schuld
    const saldo = brandstof + inUit - verschuldigd;
    this._huidigSaldo = saldo;

    const bedragStr = Math.abs(saldo).toFixed(2).replace('.', ',');
    const bedragEl = document.getElementById('afreken-saldo-val');
    const lblEl = document.getElementById('afreken-saldo-lbl');
    const subEl = document.getElementById('afreken-saldo-uitleg');
    if (bedragEl) {
      bedragEl.textContent = '€ ' + bedragStr;
      bedragEl.classList.remove('tegoed', 'schuld');
      if (saldo > 0.005) bedragEl.classList.add('tegoed');
      else if (saldo < -0.005) bedragEl.classList.add('schuld');
    }
    if (lblEl) lblEl.textContent = saldo > 0.005 ? 'JIJ HEBT TEGOED' : saldo < -0.005 ? 'JIJ BENT SCHULD' : 'SALDO';
    if (subEl) subEl.textContent = saldo > 0.005
      ? 'Vraag dit bedrag terug via een van de opties hieronder.'
      : saldo < -0.005
        ? 'Maak dit bedrag over om af te rekenen.'
        : 'Niets meer te verrekenen.';

    this._wireDeeplinks(saldo, bedragStr);

    // Verberg methode-select + markeer-knop wanneer er niets af te rekenen valt
    const methodeRij = document.querySelector('.afreken-methode-rij');
    const markeerBtn = document.getElementById('afreken-markeer');
    const teVerrekenen = Math.abs(saldo) > 0.005;
    methodeRij?.classList.toggle('hidden', !teVerrekenen);
    if (markeerBtn) markeerBtn.classList.toggle('hidden', !teVerrekenen);

    const sheet = document.getElementById('modal-afreken');
    sheet?.classList.remove('hidden');
    sheet?.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => sheet?.classList.add('is-open'));
  }

  _wireDeeplinks(saldo, bedragStr) {
    const tikkieHandle = (this._db.getTikkieHandle && this._db.getTikkieHandle()) || '';
    const bunqUser = (this._db.getBetaalverzoekUsername && this._db.getBetaalverzoekUsername()) || '';
    const revolutUser = (this._db.getRevolutUsername && this._db.getRevolutUsername()) || '';
    const teVerrekenen = Math.abs(saldo) > 0.005;

    // WhatsApp — alleen tonen wanneer er ook werkelijk iets te verrekenen valt
    const waEl = document.getElementById('afreken-whatsapp');
    if (waEl) {
      if (!teVerrekenen) {
        waEl.classList.add('hidden');
      } else {
        const tikkieUrl = tikkieHandle ? `https://tikkie.me/${tikkieHandle}` : '';
        const tekst = saldo > 0
          ? WHATSAPP_TEKST_TEGOED(bedragStr, tikkieUrl)
          : WHATSAPP_TEKST_SCHULD(bedragStr);
        waEl.setAttribute('href', 'https://wa.me/?text=' + encodeURIComponent(tekst));
        waEl.classList.remove('hidden');
      }
    }

    // Tikkie
    const tikkieEl = document.getElementById('afreken-tikkie');
    if (tikkieEl) {
      if (tikkieHandle) {
        tikkieEl.setAttribute('href', `https://tikkie.me/${tikkieHandle}`);
        tikkieEl.classList.remove('hidden');
      } else {
        tikkieEl.classList.add('hidden');
      }
    }

    // bunq
    const bunqEl = document.getElementById('afreken-bunq');
    if (bunqEl) {
      if (bunqUser) {
        bunqEl.setAttribute('href', `https://bunq.me/${bunqUser}/${Math.abs(saldo).toFixed(2)}`);
        bunqEl.classList.remove('hidden');
      } else {
        bunqEl.classList.add('hidden');
      }
    }

    // Revolut
    const revolutEl = document.getElementById('afreken-revolut');
    if (revolutEl) {
      if (revolutUser) {
        revolutEl.setAttribute('href', `https://revolut.me/${revolutUser}/${Math.abs(saldo).toFixed(2)}eur`);
        revolutEl.classList.remove('hidden');
      } else {
        revolutEl.classList.add('hidden');
      }
    }
  }

  _sluit() {
    const sheet = document.getElementById('modal-afreken');
    if (!sheet) return;
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    setTimeout(() => sheet.classList.add('hidden'), 280);
  }

  _markeerAfgerekend() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;
    const saldo = Number(this._huidigSaldo || 0);
    // Drempel ≥ 1 cent — voorkomt dat een herhaalde klik tijdens rounding-rest
    // mini-betalingen blijft registreren.
    if (Math.abs(saldo) < 0.01) {
      Utils.toast('Niets te verrekenen', 'info');
      this._sluit();
      return;
    }

    // Schrijf altijd het sentinel "Ik" weg — naam-veranderingen breken
    // anders het matchen bij volgend afreken-rondje.
    const ander = (auto.passagiers && auto.passagiers[0]) || 'Auto-deler';
    const methode = document.getElementById('afreken-methode')?.value || 'overig';

    // saldo > 0 → ik heb tegoed → ander betaalt aan mij
    // saldo < 0 → ik ben schuld → ik betaal aan ander
    const van = saldo > 0 ? ander : 'Ik';
    const naar = saldo > 0 ? 'Ik' : ander;

    this._db.addBetaling({
      id: Utils.uid(),
      auto_id: auto.id,
      datum: new Date().toISOString(),
      bedrag: parseFloat(Math.abs(saldo).toFixed(2)),
      van,
      naar,
      methode,
      notitie: 'Afgerekend via Afrekenen-sheet',
    });

    Utils.toast('Afrekening geregistreerd ✓');
    this._sluit();
  }

  /**
   * Herken of een van/naar-veld de gebruiker zelf is. Match op het sentinel
   * "Ik" én — voor oudere records — op de huidige `naam` uit de database.
   */
  _isIk(naamVeld) {
    const v = (naamVeld || '').toLowerCase().trim();
    if (!v) return false;
    if (v === 'ik') return true;
    const eigenNaam = (this._db.load && this._db.load().naam) || '';
    return !!eigenNaam && v === eigenNaam.toLowerCase().trim();
  }

  _bind() {
    if (this._gebonden) return;
    this._gebonden = true;
    document.getElementById('afreken-markeer')?.addEventListener('click', () => this._markeerAfgerekend());
    // Klik op .modal-backdrop / buiten de sheet → sluiten
    document.getElementById('modal-afreken')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-afreken') this._sluit();
    });
    // Swipe-handle om de sheet weg te swipen
    const sheet = document.querySelector('#modal-afreken .modal-sheet');
    if (sheet && typeof Utils.bindSwipeToDismiss === 'function') {
      Utils.bindSwipeToDismiss(sheet, () => this._sluit());
    }
  }
}

export default AfrekenController;
