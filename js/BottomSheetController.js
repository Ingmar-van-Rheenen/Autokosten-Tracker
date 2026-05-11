// ── BottomSheetController ────────────────────────────────────────────────────
// Beheert swipe-up/down op de bottom sheet + quick-stats + shortcut-navigatie
import { Utils } from './Utils.js';

const SWIPE_THRESHOLD = 40; // px minimale drag om te triggeren

export class BottomSheetController {
  /**
   * @param {import('./Database.js').Database} db
   * @param {(tab: string) => void} navigeerNaarTab – callback om van tab te wisselen
   */
  constructor(db, navigeerNaarTab) {
    this._db = db;
    this._navigeerNaarTab = navigeerNaarTab;
    this._expanded = false;

    this._sheet = document.getElementById('bottom-sheet');
    this._handle = document.getElementById('bs-handle');

    if (!this._sheet || !this._handle) return;

    this._bindSwipe();
    this._bindShortcuts();
  }

  // ── Publieke API ──────────────────────────────────────────────────────────

  /** Update de quick-stats in de expanded area */
  updateQuickStats() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;

    const ritten = this._db.getAutoRitten(auto.id);
    const tank = this._db.getAutoTankbeurten(auto.id);

    const { saldo } = Utils.berekenSaldo(ritten, tank, auto);

    // KM + kosten deze maand
    const kml = auto.km_per_liter ?? 1;
    const prijs = auto.prijs_per_liter ?? 0;
    const nu = new Date();
    const maandStart = new Date(nu.getFullYear(), nu.getMonth(), 1).toISOString();
    const rittenMaand = ritten.filter((r) => r.datum >= maandStart);
    const kmMaand = rittenMaand.reduce((s, r) => s + r.km, 0);
    const kostenMaand = (kmMaand / kml) * prijs;

    const saldoEl = document.getElementById('bs-q-saldo');
    const kmEl = document.getElementById('bs-q-km');
    const kostenEl = document.getElementById('bs-q-kosten');

    if (saldoEl) {
      saldoEl.textContent = (saldo >= 0 ? '+' : '−') + Utils.eur(saldo);
      saldoEl.style.color = saldo >= 0 ? 'var(--green-lite)' : '#e07070';
    }
    if (kmEl) kmEl.textContent = kmMaand > 0 ? Utils.km(kmMaand) : '0 km';
    if (kostenEl) kostenEl.textContent = kostenMaand > 0 ? Utils.eur(kostenMaand) : '€ 0,00';

    // Laatste rit
    const lrEl = document.getElementById('bs-laatste-rit');
    const lrTekst = document.getElementById('bs-lr-tekst');
    if (lrEl && lrTekst && ritten.length > 0) {
      const rit = ritten[0];
      const datumStr = this._relatieveDatum(rit.datum);
      const dest = rit.bestemming ? ` · ${rit.bestemming}` : '';
      lrTekst.textContent = `${datumStr} · ${Utils.km(rit.km)}${dest}`;
      lrEl.classList.remove('hidden');
    } else if (lrEl) {
      lrEl.classList.add('hidden');
    }
  }

  _relatieveDatum(iso) {
    const d = new Date(iso);
    const nu = new Date();
    const dagen = Math.floor((nu - d) / (1000 * 60 * 60 * 24));
    if (dagen === 0) return 'vandaag';
    if (dagen === 1) return 'gisteren';
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }

  _uitklappen() {
    this.updateQuickStats();

    // Meet de werkelijke hoogte voor de max-height animatie
    const expandedEl = document.getElementById('bs-expanded');
    if (expandedEl) {
      expandedEl.style.transition = 'none';
      expandedEl.style.maxHeight = 'none';
      const hoogte = expandedEl.scrollHeight;
      expandedEl.style.maxHeight = '';
      expandedEl.style.transition = '';
      this._sheet.style.setProperty('--bs-expand-height', hoogte + 'px');
    }

    this._expanded = true;
    this._sheet.classList.add('expanded');
  }

  /** Sluit de sheet als hij open is */
  collapse() {
    if (!this._expanded) return;
    this._expanded = false;
    this._sheet.classList.remove('expanded');
  }

  // ── Swipe-logica ──────────────────────────────────────────────────────────

  _bindSwipe() {
    let startY = 0;
    let dragging = false;

    const onStart = (e) => {
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      dragging = true;
    };

    const onEnd = (e) => {
      if (!dragging) return;
      dragging = false;

      const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      const delta = startY - endY;

      if (delta > SWIPE_THRESHOLD && !this._expanded) {
        // Swipe omhoog → expand
        this._uitklappen();
      } else if (delta < -SWIPE_THRESHOLD && this._expanded) {
        // Swipe omlaag → collapse
        this.collapse();
      }
    };

    // Touch
    this._handle.addEventListener('touchstart', onStart, { passive: true });
    this._handle.addEventListener('touchend', onEnd, { passive: true });

    // Mouse (voor desktop testen)
    this._handle.addEventListener('mousedown', onStart);
    document.addEventListener('mouseup', (e) => {
      if (dragging) onEnd(e);
    });

    // Klik op handle als toggle
    this._handle.addEventListener('click', () => {
      if (this._expanded) {
        this.collapse();
      } else {
        this._uitklappen();
      }
    });
  }

  // ── Shortcut-navigatie ────────────────────────────────────────────────────

  _bindShortcuts() {
    document.querySelectorAll('.bs-shortcut').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) {
          this.collapse();
          this._navigeerNaarTab(tab);
        }
      });
    });
  }
}
