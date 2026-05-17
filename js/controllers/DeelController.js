// ── DeelController ────────────────────────────────────────────────────────────
import { Utils } from '../core/Utils.js';


export class DeelController {
  constructor(db) {
    this._db = db;
    this._rit = null;
    this._auto = null;
    this._aantal = 2;
    this._kosten = 0;
    this._geselecteerd = new Set();

    this._bindEvents();
  }

  // ── Publieke API ─────────────────────────────────────────────────────────

  openModal(ritId) {
    const d = this._db.load();
    const rit = d.ritten.find((r) => r.id === ritId);
    if (!rit) return;

    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;

    this._rit = rit;
    this._auto = auto;
    this._aantal = 2;
    this._kosten = (rit.km / auto.km_per_liter) * auto.prijs_per_liter;
    this._geselecteerd = new Set();

    const naam = rit.bestemming ? `Rit naar ${Utils.esc(rit.bestemming)}` : 'Rit';
    const notitie = rit.notitie ? ` · ${Utils.esc(rit.notitie)}` : '';
    document.getElementById('deel-rit-naam').innerHTML = naam;
    document.getElementById('deel-rit-info').textContent =
      `${Utils.datumStr(rit.datum)} · ${Utils.km(rit.km)}${notitie}`;
    document.getElementById('deel-rit-kosten').textContent =
      `Totale kosten: ${Utils.eur(this._kosten)}`;

    const revolutUsername = this._db.getRevolutUsername();
    document.getElementById('deel-revolut').classList.toggle('hidden', !revolutUsername);

    this._renderPassagiers();
    this._herbereken();
    document.getElementById('modal-deel').classList.remove('hidden');
  }

  // ── Events ────────────────────────────────────────────────────────────────

  _bindEvents() {
    document.getElementById('modal-deel').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-deel')) this._sluitModal();
    });

    document.getElementById('deel-min').addEventListener('click', () => {
      if (this._aantal > 2) { this._aantal--; this._herbereken(); }
    });
    document.getElementById('deel-plus').addEventListener('click', () => {
      if (this._aantal < 20) { this._aantal++; this._herbereken(); }
    });

    document.getElementById('deel-kopieer').addEventListener('click', () => {
      const tekst = this._bouwBericht();
      navigator.clipboard?.writeText(tekst).then(() => {
        Utils.toast('Gekopieerd naar klembord ✓');
      }).catch(() => {
        Utils.toast('Kopiëren mislukt', 'err');
      });
    });

    document.getElementById('deel-passagier-nieuw').addEventListener('click', () => {
      this._toonPassagierInvoer();
    });

    document.getElementById('deel-passagier-bevestig').addEventListener('click', () => {
      this._voegPassagierToe();
    });

    document.getElementById('deel-passagier-inp').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._voegPassagierToe();
      if (e.key === 'Escape') this._verbergPassagierInvoer();
    });

    const sheet = document.querySelector('#modal-deel .modal-sheet');
    if (sheet) Utils.bindSwipeToDismiss(sheet, () => this._sluitModal());
  }

  _sluitModal() {
    document.getElementById('modal-deel').classList.add('hidden');
    this._verbergPassagierInvoer();
    this._rit = null;
    this._auto = null;
  }

  // ── Passagiers ────────────────────────────────────────────────────────────

  _renderPassagiers() {
    if (!this._auto) return;
    const namen = this._db.getPassagiers(this._auto.id);
    const lijst = document.getElementById('deel-passagiers-lijst');

    lijst.innerHTML = namen.map((naam) => {
      const actief = this._geselecteerd.has(naam);
      return `<button class="deel-passagier-pill${actief ? ' actief' : ''}" data-naam="${Utils.esc(naam)}">${Utils.esc(naam)}</button>`;
    }).join('');

    lijst.querySelectorAll('.deel-passagier-pill').forEach((pill) => {
      pill.addEventListener('click', () => this._togglePassagier(pill.dataset.naam));
    });
  }

  _togglePassagier(naam) {
    if (this._geselecteerd.has(naam)) {
      this._geselecteerd.delete(naam);
    } else {
      this._geselecteerd.add(naam);
      const gewenst = this._geselecteerd.size + 1;
      if (gewenst > this._aantal) this._aantal = Math.min(gewenst, 20);
    }
    this._renderPassagiers();
    this._herbereken();
  }

  _toonPassagierInvoer() {
    const invoer = document.getElementById('deel-passagier-invoer');
    const inp = document.getElementById('deel-passagier-inp');
    invoer.classList.remove('hidden');
    inp.value = '';
    inp.focus();
  }

  _verbergPassagierInvoer() {
    document.getElementById('deel-passagier-invoer').classList.add('hidden');
  }

  _voegPassagierToe() {
    const inp = document.getElementById('deel-passagier-inp');
    const naam = inp.value.trim();
    if (!naam) { this._verbergPassagierInvoer(); return; }

    const bestaand = this._db.getPassagiers(this._auto.id);
    if (!bestaand.includes(naam)) {
      this._db.setPassagiers(this._auto.id, [...bestaand, naam]);
    }
    this._geselecteerd.add(naam);
    const gewenst = this._geselecteerd.size + 1;
    if (gewenst > this._aantal) this._aantal = Math.min(gewenst, 20);

    this._verbergPassagierInvoer();
    this._renderPassagiers();
    this._herbereken();
  }

  // ── Bank betaalverzoek URL ────────────────────────────────────────────────

  _bouwBankUrl(bedrag) {
    const username = this._db.getBetaalverzoekUsername();
    if (!username) return '';
    const bedragStr = bedrag.toFixed(2);
    const omschrijving = encodeURIComponent(`Ritkosten ${this._rit?.bestemming ?? ''}`.trim());
    return `https://bunq.me/${username}/${bedragStr}/${omschrijving}`;
  }

  // ── Berekening & rendering ────────────────────────────────────────────────

  _herbereken() {
    if (!this._rit) return;

    const perPersoon = this._kosten / this._aantal;

    document.getElementById('deel-aantal').textContent = this._aantal;
    document.getElementById('deel-per-persoon').textContent = Utils.eur(perPersoon);

    const count = document.getElementById('deel-passagier-count');
    if (count) {
      count.textContent = this._geselecteerd.size > 0
        ? `(${this._geselecteerd.size} geselecteerd)`
        : '';
    }

    const revolutUsername = this._db.getRevolutUsername();
    const revolutEl = document.getElementById('deel-revolut');
    if (revolutEl && revolutUsername) {
      revolutEl.href = `https://revolut.me/${revolutUsername}`;
      revolutEl.textContent = '';
      revolutEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.924 4.124A6.5 6.5 0 0 0 14.5 0H4v24h4v-9h4.382l4.4 9H21l-4.7-9.5A6.5 6.5 0 0 0 20.924 4.124ZM14.5 11H8V4h6.5a2.5 2.5 0 0 1 0 5Z"/></svg> Betaal via Revolut · ${Utils.eur(perPersoon)} p.p.`;
    }

    const bericht = this._bouwBericht(perPersoon);
    const wa = document.getElementById('deel-whatsapp');
    if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(bericht);
  }

  _bouwBericht(perPersoon) {
    if (!this._rit) return '';

    const pp = perPersoon ?? (this._kosten / this._aantal);
    const naam = this._rit.bestemming ? `naar ${this._rit.bestemming}` : '';
    const datum = new Date(this._rit.datum).toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'long',
    });
    const km = this._rit.km.toFixed(1).replace('.', ',');
    const totaal = this._kosten.toFixed(2).replace('.', ',');
    const ppStr = pp.toFixed(2).replace('.', ',');

    const namen = [...this._geselecteerd];
    const aanhef = namen.length === 1
      ? `Hé ${namen[0]}!`
      : namen.length > 1
        ? `Hé ${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}!`
        : 'Hé!';

    const metRegel = namen.length > 0 ? `Met: ${namen.join(', ')}\n` : '';
    const betaalLinks = [];
    const revolutUsername = this._db.getRevolutUsername();
    if (revolutUsername) betaalLinks.push(`revolut.me/${revolutUsername}`);
    const tikkieHandle = (typeof this._db.getTikkieHandle === 'function') ? this._db.getTikkieHandle() : '';
    if (tikkieHandle) betaalLinks.push(`tikkie.me/${tikkieHandle}`);
    const bankUrl = this._bouwBankUrl(pp);
    if (bankUrl) betaalLinks.push(bankUrl);

    const betaalRegel = betaalLinks.length
      ? `Betalen via:\n${betaalLinks.join('\n')}`
      : `Kan je dit via overboeking sturen?`;

    return (
      `${aanhef} We reden op ${datum} ${naam} (${km} km).\n` +
      `${metRegel}` +
      `Brandstofkosten totaal: €${totaal}\n` +
      `Aandeel per persoon (1/${this._aantal}): €${ppStr}\n\n` +
      `${betaalRegel}\n\nBedankt! 🙏`
    );
  }
}
