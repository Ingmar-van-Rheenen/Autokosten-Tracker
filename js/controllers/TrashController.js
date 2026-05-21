// ── TrashController ───────────────────────────────────────────────────────────
// Rendert de prullenbak-sectie op de instellingen-tab. Verwijderde ritten,
// tankbeurten, onderhoud, vaste kosten en betalingen blijven 30 dagen bewaard
// (zie Database._naarTrash) en kunnen hier worden teruggezet of definitief
// verwijderd.
import { Utils } from '../core/Utils.js';
import { ConfirmModal } from '../ui/ConfirmModal.js';

const TYPE_LABELS = {
  rit: 'Rit',
  tankbeurt: 'Tankbeurt',
  onderhoud: 'Onderhoud',
  vaste_kost: 'Vaste kost',
  betaling: 'Betaling',
};

export class TrashController {
  constructor(db) {
    this._db = db;
    this._gebonden = false;
    this._bind();
  }

  _bind() {
    if (this._gebonden) return;
    this._gebonden = true;

    document.getElementById('trash-leeg-knop')?.addEventListener('click', async () => {
      const ja = await ConfirmModal.toon({
        titel: 'Prullenbak legen?',
        tekst: 'Alle items in de prullenbak worden definitief verwijderd. Dit kan niet ongedaan gemaakt worden.',
        bevestigLabel: 'Definitief verwijderen',
        gevaarlijk: true,
      });
      if (!ja) return;
      this._db.purgeAlleTrash();
      this.render();
      Utils.toast('Prullenbak geleegd');
    });

    // Re-render zodra er iets in de trash verandert (bv. na een swipe-delete).
    window.addEventListener('db:updated', (e) => {
      const m = e?.detail?.mutator || '';
      if (/^delete|Trash|herstelUitTrash/.test(m)) this.render();
    });
  }

  render() {
    const lijst = document.getElementById('trash-lijst');
    const leegKnop = document.getElementById('trash-leeg-knop');
    if (!lijst) return;

    const items = this._db.getTrash();

    if (!items.length) {
      lijst.innerHTML = '<li class="trash-leeg">De prullenbak is leeg.</li>';
      leegKnop?.classList.add('hidden');
      return;
    }
    leegKnop?.classList.remove('hidden');

    lijst.innerHTML = items.map((t) => {
      const typeLbl = TYPE_LABELS[t.type] || 'Item';
      const omschrijving = this._omschrijf(t);
      const verwijderdOp = new Date(t.datum).toLocaleDateString('nl-NL', {
        day: 'numeric', month: 'short',
      });
      return `
        <li class="trash-item" data-id="${t.id}">
          <div class="trash-item-info">
            <div class="trash-item-titel">
              <span class="trash-item-type">${typeLbl}</span>
              <span class="trash-item-oms">${omschrijving}</span>
            </div>
            <div class="trash-item-sub">Verwijderd op ${verwijderdOp}</div>
          </div>
          <div class="trash-item-acties">
            <button class="trash-herstel" data-id="${t.id}" type="button">Herstel</button>
            <button class="trash-purge" data-id="${t.id}" type="button" aria-label="Definitief verwijderen">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </button>
          </div>
        </li>`;
    }).join('');

    lijst.querySelectorAll('.trash-herstel').forEach((btn) => {
      btn.addEventListener('click', () => this._herstel(btn.dataset.id));
    });
    lijst.querySelectorAll('.trash-purge').forEach((btn) => {
      btn.addEventListener('click', () => this._purge(btn.dataset.id));
    });
  }

  /** Korte, leesbare samenvatting van een trash-item. */
  _omschrijf(t) {
    const it = t.item || {};
    if (t.type === 'rit') {
      const km = Number(it.km || 0).toFixed(1).replace('.', ',');
      return Utils.esc(it.bestemming ? `${km} km · ${it.bestemming}` : `${km} km`);
    }
    if (t.type === 'tankbeurt') {
      const tot = Utils.eur(Number(it.totaal) || 0);
      return Utils.esc(`${tot} · ${Number(it.liters || 0).toFixed(1).replace('.', ',')} L/kWh`);
    }
    if (t.type === 'onderhoud') {
      return Utils.esc(`${Utils.eur(Number(it.kosten) || 0)} · ${it.type || 'overig'}`);
    }
    if (t.type === 'vaste_kost') {
      return Utils.esc(`${it.label || it.type || 'Vaste kost'} · ${Utils.eur(Number(it.bedrag) || 0)}`);
    }
    if (t.type === 'betaling') {
      return Utils.esc(`${Utils.eur(Number(it.bedrag) || 0)} · ${it.van || '?'} → ${it.naar || '?'}`);
    }
    return '—';
  }

  _herstel(trashId) {
    if (!trashId) return;
    const ok = this._db.herstelUitTrash(trashId);
    this.render();
    Utils.toast(ok ? 'Teruggezet ✓' : 'Herstellen mislukt', ok ? 'ok' : 'err');
  }

  async _purge(trashId) {
    if (!trashId) return;
    const ja = await ConfirmModal.toon({
      titel: 'Definitief verwijderen?',
      tekst: 'Dit item wordt permanent verwijderd en kan niet meer worden teruggezet.',
      bevestigLabel: 'Verwijder',
      gevaarlijk: true,
    });
    if (!ja) return;
    this._db.purgeTrashItem(trashId);
    this.render();
    Utils.toast('Definitief verwijderd');
  }
}

export default TrashController;
