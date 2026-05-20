// ── MaandRecapController ──────────────────────────────────────────────────────
// "Spotify-Wrapped"-achtige terugblik op de vorige maand. Aggregeert ritten,
// tankbeurten en saldo voor de geselecteerde auto, en presenteert ze in zes
// swipebare cards. Automatisch geopend bij de eerste app-opening van een
// nieuwe maand (gekoppeld aan een localStorage-marker per maand), en
// handmatig vanuit de saldo-tab.
import { Utils } from '../core/Utils.js';

const MAAND_NAMEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

const PAGES = ['intro', 'afstand', 'brand', 'verbruik', 'bestemmingen', 'outro'];

const GEZIEN_PREFIX = 'tanklog_recap_gezien_';

export class MaandRecapController {
  /**
   * @param {import('../core/Database.js').Database} db
   * @param {{ afreken?: { openSheet?: () => void } }} [deps]
   */
  constructor(db, deps = {}) {
    this._db = db;
    this._deps = deps;
    this._gebonden = false;
    this._huidigeIndex = 0;
    this._auto = null;
    this._data = null;
    this._historyActief = false;
  }

  // ── Auto-trigger ───────────────────────────────────────────────────────────

  /**
   * Roep aan zodra de app gestart is: toon de recap éénmalig als we een nieuwe
   * kalendermaand zijn ingegaan én er voor de vorige maand data bestaat.
   * Stille no-op als de gebruiker hem al gezien heeft of er geen activiteit was.
   */
  controleerAutoStart() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;

    const nu = new Date();
    // De vorige maand (m=0 januari) — let op jaar-overslag bij januari.
    const peil = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
    const jaar = peil.getFullYear();
    const maand = peil.getMonth(); // 0-indexed

    if (this._isGezien(auto.id, jaar, maand)) return;

    const data = this._aggregeer(auto, jaar, maand);
    if (!data || data.ritten.length === 0) {
      // Geen activiteit in die maand — markeer als "gezien" zodat we niet
      // elke startup opnieuw checken (cheap idempotent).
      this._zetGezien(auto.id, jaar, maand);
      return;
    }

    // Wacht tot het app-scherm helemaal binnen is voordat de recap eroverheen valt.
    setTimeout(() => this.open(jaar, maand), 800);
  }

  /** Open handmatig. Default = vorige maand van de geselecteerde auto. */
  open(jaar, maand) {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) { Utils.toast('Geen auto geselecteerd', 'err'); return; }

    if (jaar == null || maand == null) {
      const nu = new Date();
      const peil = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
      jaar = peil.getFullYear();
      maand = peil.getMonth();
    }

    this._auto = auto;
    this._data = this._aggregeer(auto, jaar, maand);
    if (!this._data) return;

    this._bindEvents();
    this._render();
    this._toonOverlay();
    this._zetGezien(auto.id, jaar, maand);
  }

  close() {
    if (this._historyActief) {
      history.back();
    } else {
      this._doeDicht();
    }
  }

  _toonOverlay() {
    const overlay = document.getElementById('recap-overlay');
    if (!overlay) return;

    if (!this._historyActief) {
      history.pushState({ recap: true }, '');
      this._historyActief = true;
    }

    overlay.classList.remove('hidden');
    this._huidigeIndex = 0;
    this._toonPagina(0, /* animeer */ false);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      overlay.classList.add('zichtbaar');
    }));
  }

  _doeDicht() {
    this._historyActief = false;
    const overlay = document.getElementById('recap-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    overlay.classList.remove('zichtbaar');
    setTimeout(() => overlay.classList.add('hidden'), 320);
  }

  // ── Data-aggregatie ────────────────────────────────────────────────────────

  _aggregeer(auto, jaar, maand) {
    const ritten = this._filterMaand(this._db.getAutoRitten(auto.id), jaar, maand);
    const tank = this._filterMaand(this._db.getAutoTankbeurten(auto.id), jaar, maand);

    // Vorige maand (m=−1 → december vorig jaar)
    const vorigePeil = new Date(jaar, maand - 1, 1);
    const vorigeRitten = this._filterMaand(
      this._db.getAutoRitten(auto.id),
      vorigePeil.getFullYear(),
      vorigePeil.getMonth(),
    );
    const vorigeTank = this._filterMaand(
      this._db.getAutoTankbeurten(auto.id),
      vorigePeil.getFullYear(),
      vorigePeil.getMonth(),
    );

    const km = ritten.reduce((s, r) => s + (Number(r.km) || 0), 0);
    const vorigeKm = vorigeRitten.reduce((s, r) => s + (Number(r.km) || 0), 0);

    const kosten = tank.reduce((s, t) => s + (Number(t.totaal) || 0), 0);
    const volume = tank.reduce((s, t) => s + (Number(t.liters) || 0), 0);
    const isEV = auto.type === 'elektrisch';
    // Gewogen gemiddelde van prijs (anders trekt één klein tankje het gemiddelde scheef).
    let gemPrijs = 0;
    if (volume > 0) gemPrijs = kosten / volume;

    const verbruik = Utils.km100l(ritten, tank); // L (of kWh) per 100km
    const vorigeVerbruik = Utils.km100l(vorigeRitten, vorigeTank);

    const langste = ritten.slice().sort((a, b) => (b.km || 0) - (a.km || 0))[0] || null;
    const top = this._topBestemmingen(ritten, 3);

    // Saldo over de hele auto (cumulatief) — sluit aan bij de hoofd-app.
    const alleRitten = this._db.getAutoRitten(auto.id) || [];
    const alleTank = this._db.getAutoTankbeurten(auto.id) || [];
    const { saldo } = Utils.berekenSaldo(alleRitten, alleTank, auto);

    return {
      auto,
      jaar,
      maand,
      ritten,
      tank,
      km,
      vorigeKm,
      kosten,
      volume,
      gemPrijs,
      verbruik,
      vorigeVerbruik,
      langste,
      top,
      saldo,
      isEV,
    };
  }

  _filterMaand(items, jaar, maand) {
    return (items || []).filter((it) => {
      const ts = Date.parse(it?.datum);
      if (Number.isNaN(ts)) return false;
      const d = new Date(ts);
      return d.getFullYear() === jaar && d.getMonth() === maand;
    });
  }

  _topBestemmingen(ritten, n) {
    const teller = new Map();
    ritten.forEach((r) => {
      const naam = (r.bestemming || '').trim();
      if (!naam) return;
      const sleutel = naam.toLowerCase();
      const huidig = teller.get(sleutel) || { naam, aantal: 0, km: 0 };
      huidig.aantal += 1;
      huidig.km += Number(r.km) || 0;
      teller.set(sleutel, huidig);
    });
    return Array.from(teller.values())
      .sort((a, b) => b.aantal - a.aantal || b.km - a.km)
      .slice(0, n);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _render() {
    const d = this._data;
    if (!d) return;

    const maandNaam = MAAND_NAMEN[d.maand] || '—';
    const maandLabel = maandNaam.charAt(0).toUpperCase() + maandNaam.slice(1);

    // Intro
    this._setText('recap-titel', `${maandLabel} ${d.jaar} in cijfers`);
    this._setText('recap-sub', `${d.auto.naam}${d.auto.merk ? ' · ' + d.auto.merk : ''}`);

    // Afstand
    this._setCount('recap-km', d.km, 1);
    this._setText('recap-ritten', String(d.ritten.length));
    const gemPerRit = d.ritten.length ? d.km / d.ritten.length : 0;
    this._setText('recap-gem-km', gemPerRit ? gemPerRit.toFixed(1).replace('.', ',') + ' km' : '—');
    this._setText('recap-km-delta', this._deltaTekst(d.km, d.vorigeKm, 'km'));
    this._setDeltaKleur('recap-km-delta', d.km, d.vorigeKm, /* hogerIsBeter */ false);

    // Brandstof / laden
    const brandChip = d.isEV ? 'LADEN' : 'BRANDSTOF';
    const volumeLbl = d.isEV ? 'kWh' : 'Liters';
    const prijsLbl = d.isEV ? 'Gem. €/kWh' : 'Gem. €/L';
    this._setText('recap-brand-chip', brandChip);
    this._setText('recap-volume-lbl', volumeLbl);
    this._setText('recap-prijs-lbl', prijsLbl);
    this._setCount('recap-kosten', d.kosten, 2);
    this._setText('recap-volume', d.volume > 0
      ? d.volume.toFixed(1).replace('.', ',') + (d.isEV ? ' kWh' : ' L')
      : '—');
    this._setText('recap-prijs', d.gemPrijs > 0
      ? '€ ' + d.gemPrijs.toFixed(d.isEV ? 3 : 2).replace('.', ',')
      : '—');
    this._setText('recap-brand-sub', d.tank.length
      ? `${d.tank.length} ${d.isEV ? 'laadbeurten' : 'tankbeurten'}`
      : (d.isEV ? 'Geen laadbeurten geboekt' : 'Geen tankbeurten geboekt'));

    // Verbruik
    const verbruikEen = d.isEV ? 'kWh/100km' : 'L/100km';
    this._setText('recap-verbruik-unit', verbruikEen);
    this._setText('recap-verbruik', d.verbruik > 0
      ? d.verbruik.toFixed(1).replace('.', ',')
      : '—');
    this._setText('recap-verbruik-delta',
      this._verbruikDeltaTekst(d.verbruik, d.vorigeVerbruik, verbruikEen));
    // Lager verbruik is beter (zuiniger).
    this._setDeltaKleur('recap-verbruik-delta', d.vorigeVerbruik, d.verbruik, false);
    this._setText('recap-verbruik-quote', this._verbruikQuote(d));

    // Bestemmingen
    const lijst = document.getElementById('recap-top-list');
    if (lijst) {
      if (d.top.length === 0) {
        lijst.innerHTML = '<li class="recap-top-leeg">Geen bestemmingen vastgelegd voor deze maand.</li>';
      } else {
        lijst.innerHTML = d.top.map((t, i) => `
          <li class="recap-top-rij">
            <span class="recap-top-rang">#${i + 1}</span>
            <div class="recap-top-info">
              <span class="recap-top-naam">${Utils.esc(t.naam)}</span>
              <span class="recap-top-sub">${t.aantal}× · ${t.km.toFixed(0)} km</span>
            </div>
          </li>`).join('');
      }
    }
    this._setText('recap-top-quote', d.langste
      ? `Langste rit: ${d.langste.bestemming || '—'} · ${(d.langste.km || 0).toFixed(1).replace('.', ',')} km`
      : '');

    // Outro
    const teken = d.saldo >= 0 ? '+ €' : '− €';
    this._setText('recap-saldo-teken', teken);
    this._setCount('recap-saldo', Math.abs(d.saldo), 2);
    this._setText('recap-saldo-sub', d.saldo > 0.005
      ? 'Tegoed — je hebt meer betaald dan gereden'
      : d.saldo < -0.005
        ? 'Nog te betalen — tijd om af te rekenen'
        : 'Helemaal in balans');

    // Progress-balkjes opbouwen (exact zoveel als PAGES)
    const prog = document.getElementById('recap-progress');
    if (prog && prog.children.length !== PAGES.length) {
      prog.innerHTML = PAGES.map(() =>
        '<div class="recap-progress-balk"><span class="recap-progress-balk-vul"></span></div>'
      ).join('');
    }
  }

  /** Korte uitleg-zin op de verbruik-card, afhankelijk van delta. */
  _verbruikQuote(d) {
    if (!(d.verbruik > 0)) return 'Te weinig data om een gemiddelde te berekenen.';
    if (!(d.vorigeVerbruik > 0)) return 'Eerste maand met data — vanaf nu vergelijken we.';
    const delta = d.verbruik - d.vorigeVerbruik;
    if (Math.abs(delta) < 0.05) return 'Vrijwel identiek aan vorige maand.';
    return delta < 0
      ? 'Je reed zuiniger dan vorige maand. Mooi.'
      : 'Iets minder zuinig dan vorige maand.';
  }

  /** Bv. "+12,4 km t.o.v. vorige maand" — leeg wanneer er geen vergelijking is. */
  _deltaTekst(huidig, vorige, eenheid) {
    if (!(vorige > 0)) return huidig > 0 ? 'Eerste maand met activiteit.' : '';
    const delta = huidig - vorige;
    const pct = Math.round((delta / vorige) * 100);
    const teken = delta >= 0 ? '+' : '−';
    return `${teken}${Math.abs(delta).toFixed(0)} ${eenheid} (${teken}${Math.abs(pct)}%) t.o.v. vorige maand`;
  }

  _verbruikDeltaTekst(huidig, vorige, eenheid) {
    if (!(vorige > 0) || !(huidig > 0)) return '';
    const delta = huidig - vorige;
    if (Math.abs(delta) < 0.05) return 'Vrijwel gelijk aan vorige maand';
    const teken = delta > 0 ? '+' : '−';
    return `${teken}${Math.abs(delta).toFixed(1).replace('.', ',')} ${eenheid} vs. vorige maand`;
  }

  _setDeltaKleur(id, vergelijk, basis, hogerIsBeter) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('beter', 'slecht');
    if (!(basis > 0) || !(vergelijk > 0)) return;
    const beter = hogerIsBeter ? vergelijk > basis : vergelijk < basis;
    el.classList.add(beter ? 'beter' : 'slecht');
  }

  _setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  /**
   * Toon een getal als doelwaarde op het element — animeert vanaf 0 omhoog
   * met requestAnimationFrame zodra de pagina actief wordt.
   */
  _setCount(id, waarde, decimalen) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.doel = String(waarde);
    el.dataset.decimalen = String(decimalen);
    // Reset zichtbare waarde — wordt geanimeerd zodra de page actief wordt.
    el.textContent = (0).toFixed(decimalen).replace('.', ',');
  }

  _animeerCount(el) {
    const doel = parseFloat(el.dataset.doel || '0');
    const dec = parseInt(el.dataset.decimalen || '0', 10);
    if (!Number.isFinite(doel)) { el.textContent = '—'; return; }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || doel === 0) {
      el.textContent = doel.toFixed(dec).replace('.', ',');
      return;
    }

    const start = performance.now();
    const duur = 900;
    const tick = (nu) => {
      const t = Math.min(1, (nu - start) / duur);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - t, 3);
      const waarde = doel * ease;
      el.textContent = waarde.toFixed(dec).replace('.', ',');
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ── Navigatie ──────────────────────────────────────────────────────────────

  _toonPagina(index, animeer = true) {
    const stack = document.getElementById('recap-stack');
    const card = document.querySelector('#recap-overlay .recap-card');
    if (!stack || !card) return;

    const totaal = stack.querySelectorAll('.recap-page').length;
    index = Math.max(0, Math.min(totaal - 1, index));
    this._huidigeIndex = index;

    stack.querySelectorAll('.recap-page').forEach((p, i) => {
      p.classList.toggle('actief', i === index);
    });

    // Mood-gradient op de card via data-attribuut.
    const naam = PAGES[index] || 'intro';
    card.setAttribute('data-page', naam);

    // Progress-balkjes
    document.querySelectorAll('#recap-progress .recap-progress-balk').forEach((b, i) => {
      b.classList.toggle('gedaan', i < index);
      b.classList.toggle('actief', i === index);
    });

    // Count-up animaties starten zodra een page met data-doel actief wordt.
    const actief = stack.querySelectorAll('.recap-page')[index];
    if (actief && animeer) {
      actief.querySelectorAll('[data-doel]').forEach((el) => this._animeerCount(el));
    }
  }

  _volgende() {
    if (this._huidigeIndex >= PAGES.length - 1) {
      // Laatste page → afronden = sluiten.
      this.close();
      return;
    }
    this._toonPagina(this._huidigeIndex + 1);
  }

  _vorige() {
    if (this._huidigeIndex <= 0) return;
    this._toonPagina(this._huidigeIndex - 1);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  _bindEvents() {
    if (this._gebonden) return;
    this._gebonden = true;

    document.getElementById('recap-sluit')?.addEventListener('click', () => this.close());
    document.getElementById('recap-backdrop')?.addEventListener('click', () => this.close());

    document.getElementById('recap-tap-vorige')?.addEventListener('click', () => this._vorige());
    document.getElementById('recap-tap-volgende')?.addEventListener('click', () => this._volgende());
    document.getElementById('recap-pijl-l')?.addEventListener('click', () => this._vorige());
    document.getElementById('recap-pijl-r')?.addEventListener('click', () => this._volgende());

    document.getElementById('recap-afreken')?.addEventListener('click', () => {
      this.close();
      // Wacht tot de sluit-animatie klaar is — anders flitsen twee overlays.
      setTimeout(() => this._deps.afreken?.openSheet?.(), 380);
    });
    document.getElementById('recap-klaar')?.addEventListener('click', () => this.close());

    // Toetsenbord: pijltjes/Escape
    document.addEventListener('keydown', (e) => {
      const overlay = document.getElementById('recap-overlay');
      if (!overlay || overlay.classList.contains('hidden')) return;
      if (e.key === 'Escape') { this.close(); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); this._volgende(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this._vorige(); }
    });

    // Hardware-/browser-terugknop → recap sluiten i.p.v. app verlaten.
    window.addEventListener('popstate', () => {
      if (this._historyActief) this._doeDicht();
    });

    this._bindSwipe();
  }

  /** Horizontale swipe op de card-stack → volgende/vorige pagina. */
  _bindSwipe() {
    const stack = document.getElementById('recap-stack');
    if (!stack) return;
    const DREMPEL = 50;
    let startX = 0;
    let startY = 0;
    let bezig = false;
    let dx = 0;

    stack.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) { bezig = false; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      bezig = true;
      dx = 0;
    }, { passive: true });

    stack.addEventListener('touchmove', (e) => {
      if (!bezig) return;
      dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      // Verticale swipes laten we met rust (scroll/intent).
      if (Math.abs(dy) > Math.abs(dx)) { bezig = false; dx = 0; }
    }, { passive: true });

    stack.addEventListener('touchend', () => {
      if (!bezig) return;
      bezig = false;
      if (dx <= -DREMPEL) this._volgende();
      else if (dx >= DREMPEL) this._vorige();
    });
  }

  // ── localStorage gezien-markers ────────────────────────────────────────────

  _isGezien(autoId, jaar, maand) {
    try {
      return localStorage.getItem(this._gezienKey(autoId, jaar, maand)) === '1';
    } catch { return true; /* fail-safe: niet tonen */ }
  }

  _zetGezien(autoId, jaar, maand) {
    try { localStorage.setItem(this._gezienKey(autoId, jaar, maand), '1'); }
    catch { /* quota — niet kritiek */ }
  }

  _gezienKey(autoId, jaar, maand) {
    const mm = String(maand + 1).padStart(2, '0');
    return `${GEZIEN_PREFIX}${autoId}_${jaar}-${mm}`;
  }
}

export default MaandRecapController;
