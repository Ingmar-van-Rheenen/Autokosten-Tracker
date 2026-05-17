// ── VasteKostenWidget ───────────────────────────────────────────────────────
// Lijst van vaste kosten met bedrag/maand + totaal-footer.
import { Utils } from '../../core/Utils.js';

export class VasteKostenWidget {
  constructor(db) {
    this._db = db;
  }

  render(auto) {
    const vk = this._db.getAutoVasteKosten?.(auto.id) || [];
    const lijst = document.getElementById('dash-vk-lijst');
    if (!lijst) return;

    if (!vk.length) {
      lijst.innerHTML = '<li class="dash-mini-leeg">Nog geen vaste kosten.</li>';
      return;
    }

    const rijen = this.renderRows(vk, 4);
    const totaal = vk.reduce((acc, v) => {
      const b = Number(v.bedrag || 0);
      return acc + (v.frequentie === 'jaarlijks' ? b / 12 : b);
    }, 0);

    lijst.innerHTML = rijen + `
      <li class="dash-vk-totaal">
        <span class="dash-vk-totaal-lbl">Per maand</span>
        <span class="dash-vk-totaal-val">${Utils.eur(totaal)}</span>
      </li>`;
  }

  renderRows(vk, limit) {
    return vk.slice(0, limit).map((v) => {
      const bedrag = Number(v.bedrag || 0);
      const perMaand = v.frequentie === 'jaarlijks' ? bedrag / 12 : bedrag;
      return `
        <li class="dash-vk-rij">
          <span class="dash-vk-naam">${Utils.esc(v.label || v.type || 'Onbekend')}</span>
          <span class="dash-vk-bedrag">${Utils.eur(perMaand)}</span>
        </li>`;
    }).join('');
  }

  renderExpanded(auto) {
    const vk = this._db.getAutoVasteKosten?.(auto.id) || [];
    const lijst = document.getElementById('dash-vk-lijst');
    if (lijst) lijst.innerHTML = this.renderRows(vk, 20);
  }
}

export default VasteKostenWidget;
