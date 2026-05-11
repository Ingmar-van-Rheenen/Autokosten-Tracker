// ── Utils ────────────────────────────────────────────────────────────────────
export class Utils {
  static uid() {
    return crypto.randomUUID();
  }

  /** Haversine afstand in km tussen twee {lat,lng} punten */
  static haversine(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2
      + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  /** Bereken saldo: tegoed (tankbeurten) minus verschuldigd (ritten) */
  static berekenSaldo(ritten, tankbeurten, auto) {
    const gereden = ritten.reduce((s, r) => s + (r.km ?? 0), 0);
    const betaald = tankbeurten.reduce((s, t) => s + (t.totaal ?? 0), 0);
    let verschuldigd;
    if (auto.type === 'elektrisch') {
      verschuldigd = (gereden / 100) * (auto.kwh_per_100km || 15) * (auto.prijs_per_kwh || 0.25);
    } else {
      verschuldigd = (gereden / (auto.km_per_liter || 14)) * (auto.prijs_per_liter || 2.10);
    }
    return { saldo: betaald - verschuldigd, betaald, verschuldigd, gereden };
  }

  static eur(v) {
    return '€ ' + Math.abs(v).toFixed(2).replace('.', ',');
  }

  static km(v) {
    return v.toFixed(1).replace('.', ',') + ' km';
  }

  static datumStr(iso) {
    return new Date(iso).toLocaleString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  static begroeting() {
    const h = new Date().getHours();
    return h < 12 ? 'GOEDEMORGEN' : h < 18 ? 'GOEDEMIDDAG' : 'GOEDENAVOND';
  }

  static wacht(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Escape HTML special characters to prevent XSS */
  static esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Voeg swipe-naar-beneden-sluiten toe aan een bottom-sheet panel.
   * @param {HTMLElement} panelEl  Het scrollbare sheet-element
   * @param {() => void} onDismiss Wordt aangeroepen na de sluit-animatie
   * @param {number} threshold     Minimale drag in px om te triggeren (standaard 80)
   */
  static bindSwipeToDismiss(panelEl, onDismiss, threshold = 80) {
    let startY = 0;
    let dragging = false;
    let moved = 0;

    panelEl.addEventListener('touchstart', (e) => {
      if (panelEl.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      dragging = true;
      moved = 0;
    }, { passive: true });

    panelEl.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { dragging = false; return; }
      moved = dy;
      panelEl.style.transition = 'none';
      panelEl.style.transform = `translateY(${dy}px)`;
      e.preventDefault();
    }, { passive: false });

    panelEl.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      if (moved >= threshold) {
        panelEl.style.transition = 'transform 0.26s cubic-bezier(0.4, 0, 1, 1)';
        panelEl.style.transform = 'translateY(100%)';
        setTimeout(() => {
          panelEl.style.transition = '';
          panelEl.style.transform = '';
          onDismiss();
        }, 260);
      } else {
        panelEl.style.transition = '';
        panelEl.style.transform = '';
      }
    }, { passive: true });
  }

  /** Show a small in-app toast notification (replaces browser alert) */
  static toast(tekst, type = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = tekst;
    document.body.appendChild(el);
    // Double rAF ensures CSS transition fires after paint
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast-in')));
    setTimeout(() => {
      el.classList.remove('toast-in');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, 2400);
  }
}
