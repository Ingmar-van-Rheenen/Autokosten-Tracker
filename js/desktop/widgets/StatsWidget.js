// ── StatsWidget ─────────────────────────────────────────────────────────────
// 2×2 grid: totaal km, ritten, l/100km, € per km.
import { Utils } from '../../Utils.js';

export class StatsWidget {
  constructor(db) {
    this._db = db;
  }

  render(auto) {
    const ritten = this._db.getAutoRitten(auto.id) || [];
    const tank = this._db.getAutoTankbeurten(auto.id) || [];
    const vk = this._db.getAutoVasteKosten?.(auto.id) || [];

    const totaalKm = ritten.reduce((s, r) => s + Number(r.km || 0), 0);
    const km100l = typeof Utils.km100l === 'function' ? Utils.km100l(ritten, tank) : 0;
    const eurPerKm = typeof Utils.kostenPerKm === 'function'
      ? Utils.kostenPerKm(ritten, tank, vk) : 0;

    const cellen = [
      { lbl: 'Totaal', val: totaalKm.toFixed(0), sub: 'KM' },
      { lbl: 'Ritten', val: String(ritten.length), sub: '' },
      { lbl: 'Verbruik', val: km100l > 0 ? km100l.toFixed(1).replace('.', ',') : '—', sub: 'L/100KM' },
      { lbl: '€ per km', val: eurPerKm > 0 ? Utils.eur(eurPerKm).replace('€ ', '€') : '—', sub: '' },
    ];

    const grid = document.getElementById('dash-stats-grid');
    if (!grid) return;
    grid.innerHTML = cellen.map((c) => `
      <div class="dash-stat-cel">
        <div class="dash-stat-cel-lbl">${c.lbl}</div>
        <div class="dash-stat-cel-val">${c.val}</div>
        ${c.sub ? `<div class="dash-stat-cel-sub">${c.sub}</div>` : ''}
      </div>
    `).join('');
  }
}

export default StatsWidget;
