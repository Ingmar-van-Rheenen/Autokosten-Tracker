// ── KaartWidget ─────────────────────────────────────────────────────────────
// SVG-thumbnail van de laatste rit met gps_track. Normaliseert lat/lng naar
// 320×120 viewBox; toont datum + km in de footer-overlay.

export class KaartWidget {
  constructor(db) {
    this._db = db;
  }

  render(auto) {
    const ritten = this._db.getAutoRitten(auto.id) || [];
    const laatste = ritten.find((r) => Array.isArray(r.gps_track) && r.gps_track.length >= 2);

    const wrap = document.getElementById('dash-kaart-wrap');
    const datumEl = document.getElementById('dash-kaart-datum');
    const kmEl = document.getElementById('dash-kaart-km');
    const svg = document.getElementById('dash-kaart-svg');
    if (!wrap || !svg) return;

    if (!laatste || !laatste.gps_track) {
      this._renderLeeg(svg, wrap, datumEl, kmEl);
      return;
    }

    wrap.classList.remove('leeg');
    wrap.querySelector('.dash-kaart-leeg')?.remove();

    svg.innerHTML = `<polyline class="dash-kaart-route" points="${this._normaliseer(laatste.gps_track)}"/>`;

    if (datumEl) {
      datumEl.textContent = new Date(laatste.datum).toLocaleDateString('nl-NL', {
        day: 'numeric', month: 'short',
      });
    }
    if (kmEl) {
      kmEl.textContent = Number(laatste.km || 0).toFixed(1).replace('.', ',') + ' km';
    }
  }

  /** Normaliseer een gps_track [[lat,lng], ...] naar polyline-points binnen 320×120 viewBox. */
  _normaliseer(pts) {
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const rangeLat = Math.max(0.0001, maxLat - minLat);
    const rangeLng = Math.max(0.0001, maxLng - minLng);
    const pad = 12;
    const w = 320 - pad * 2;
    const h = 120 - pad * 2;

    return pts.map(([lat, lng]) => {
      const x = pad + ((lng - minLng) / rangeLng) * w;
      const y = pad + (1 - (lat - minLat) / rangeLat) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  _renderLeeg(svg, wrap, datumEl, kmEl) {
    svg.innerHTML = '';
    if (datumEl) datumEl.textContent = '';
    if (kmEl) kmEl.textContent = '';
    wrap.classList.add('leeg');
    if (!wrap.querySelector('.dash-kaart-leeg')) {
      const p = document.createElement('p');
      p.className = 'dash-kaart-leeg';
      p.textContent = 'Smart-tracking nog niet gebruikt. Log een rit met GPS-tracking om de route hier te zien.';
      wrap.appendChild(p);
    }
  }
}

export default KaartWidget;
