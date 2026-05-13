// ── RittenWidget ────────────────────────────────────────────────────────────
// Toont de laatste 5 ritten in compacte vorm; bij expanded view tot 20.
import { Utils } from '../../Utils.js';

export class RittenWidget {
  constructor(db) {
    this._db = db;
  }

  render(auto) {
    const ritten = this._db.getAutoRitten(auto.id) || [];
    const lijst = document.getElementById('dash-ritten-lijst');
    if (!lijst) return;
    lijst.innerHTML = ritten.length
      ? this.renderRows(ritten, 5)
      : '<li class="dash-mini-leeg">Nog geen ritten gelogd.</li>';
  }

  /** Render rijen, gebruikt voor zowel compact als expanded view. */
  renderRows(ritten, limit) {
    return ritten.slice(0, limit).map((r) => {
      const datum = new Date(r.datum).toLocaleDateString('nl-NL', {
        day: 'numeric', month: 'short',
      });
      const km = Number(r.km || 0).toFixed(1).replace('.', ',');
      return `
        <li class="dash-mini-rij">
          <div>
            <div class="dash-mini-naam">${km} km</div>
            <span class="dash-mini-sub">${datum}${r.notitie ? ' · ' + Utils.esc(r.notitie) : ''}</span>
          </div>
        </li>`;
    }).join('');
  }

  renderExpanded(auto) {
    const ritten = this._db.getAutoRitten(auto.id) || [];
    const lijst = document.getElementById('dash-ritten-lijst');
    if (lijst) lijst.innerHTML = this.renderRows(ritten, 20);
  }
}

export default RittenWidget;
