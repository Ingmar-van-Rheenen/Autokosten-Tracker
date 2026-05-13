// ── TankWidget ──────────────────────────────────────────────────────────────
// Toont de laatste 5 tankbeurten; bij expanded view tot 20.
// Past zich aan op elektrische auto's (kWh-label ipv L).
import { Utils } from '../../core/Utils.js';

export class TankWidget {
  constructor(db) {
    this._db = db;
  }

  render(auto) {
    const tank = this._db.getAutoTankbeurten(auto.id) || [];
    const lijst = document.getElementById('dash-tank-lijst');
    if (!lijst) return;
    lijst.innerHTML = tank.length
      ? this.renderRows(tank, 5, auto.type === 'elektrisch')
      : '<li class="dash-mini-leeg">Nog geen tankbeurten.</li>';
  }

  renderRows(tank, limit, elektrisch) {
    const eenheid = elektrisch ? 'kWh' : 'L';
    return tank.slice(0, limit).map((t) => {
      const datum = new Date(t.datum).toLocaleDateString('nl-NL', {
        day: 'numeric', month: 'short',
      });
      const hoeveelheid = Number(t.liters || 0).toFixed(2).replace('.', ',');
      const totaal = Utils.eur(Number(t.totaal || 0));
      return `
        <li class="dash-mini-rij">
          <div>
            <div class="dash-mini-naam">${hoeveelheid} ${eenheid}</div>
            <span class="dash-mini-sub">${datum}</span>
          </div>
          <span class="dash-mini-val">${totaal}</span>
        </li>`;
    }).join('');
  }

  renderExpanded(auto) {
    const tank = this._db.getAutoTankbeurten(auto.id) || [];
    const lijst = document.getElementById('dash-tank-lijst');
    if (lijst) lijst.innerHTML = this.renderRows(tank, 20, auto.type === 'elektrisch');
  }
}

export default TankWidget;
