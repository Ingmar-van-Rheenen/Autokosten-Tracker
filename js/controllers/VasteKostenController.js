// ── VasteKostenController ─────────────────────────────────────────────────────
// Beheert terugkerende vaste kosten per auto (verzekering, wegenbelasting, apk,
// onderhoud-abonnement, parkeervergunning, overig). Frequentie maandelijks
// of jaarlijks. Renders #vk-lijst en bedient #sheet-vaste-kost.
import { Utils } from '../core/Utils.js';
import { ConfirmModal } from '../ui/ConfirmModal.js';

const TYPE_LABELS = {
  verzekering: 'Verzekering',
  wegenbelasting: 'Wegenbelasting',
  apk: 'APK',
  onderhoud: 'Onderhoud',
  parkeren: 'Parkeervergunning',
  overig: 'Overig',
};

const FREQ_LABELS = {
  maandelijks: '/ maand',
  jaarlijks: '/ jaar',
};

export class VasteKostenController {
  constructor(db) {
    this._db = db;
    this._bewerkenId = null;
    this._gebonden = false;
    this._bind();

    // Auto-re-render bij db-mutaties
    window.addEventListener('db:updated', (e) => {
      const m = e?.detail?.mutator || '';
      if (m.includes('VasteKost') || m === 'save' || m === 'resetAuto' || m === 'verwijderAlles') {
        this.render();
      }
    });
  }

  render() {
    const auto = this._db.getGeselecteerdeAuto();
    const items = auto ? this._db.getAutoVasteKosten(auto.id) : [];
    const lijst = document.getElementById('vk-lijst');
    if (!lijst) return;

    if (!items.length) {
      lijst.innerHTML = `
        <div class="lijst-leeg-blok">
          <div class="lijst-leeg-icoon">
            <svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/></svg>
          </div>
          <div class="lijst-leeg-titel">Nog geen vaste kosten</div>
          <div class="lijst-leeg-sub">Voeg verzekering, wegenbelasting, APK of parkeervergunning toe — terugkerende uitgaven verschijnen in je maandoverzicht.</div>
        </div>`;
      return;
    }

    lijst.innerHTML = items.map((v) => {
      const type = TYPE_LABELS[v.type] || v.type || 'Overig';
      const freq = FREQ_LABELS[v.frequentie] || '';
      const bedrag = Number(v.bedrag || 0).toFixed(2).replace('.', ',');
      const label = Utils.esc(v.label || type);
      return `
        <li class="vk-kaart" data-id="${v.id}">
          <div class="vk-kaart-icoon" aria-hidden="true">€</div>
          <div class="vk-kaart-info">
            <div class="vk-kaart-label">${label}</div>
            <div class="vk-kaart-meta">${Utils.esc(type).toUpperCase()}${v.notitie ? ' · ' + Utils.esc(v.notitie) : ''}</div>
          </div>
          <div class="vk-kaart-bedrag">€ ${bedrag} <span class="vk-kaart-meta">${freq}</span></div>
          <button class="vk-kaart-edit" data-id="${v.id}" aria-label="Bewerken">
            <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </li>
      `;
    }).join('');

    lijst.querySelectorAll('.vk-kaart-edit').forEach((btn) => {
      btn.addEventListener('click', () => this.openSheet(btn.dataset.id));
    });
  }

  /** Open de sheet. Met id => bewerk-modus, zonder id => nieuwe vaste kost. */
  openSheet(id) {
    const sheet = document.getElementById('sheet-vaste-kost');
    if (!sheet) return;
    this._bewerkenId = id || null;

    const titelEl = document.getElementById('vk-modal-titel');
    const verwBtn = document.getElementById('vk-verwijder');

    if (id) {
      const auto = this._db.getGeselecteerdeAuto();
      const items = auto ? this._db.getAutoVasteKosten(auto.id) : [];
      const v = items.find((x) => x.id === id);
      if (!v) return;

      if (titelEl) titelEl.textContent = 'Vaste kost bewerken';
      document.getElementById('vk-label').value = v.label || '';
      document.getElementById('vk-type').value = v.type || 'overig';
      document.getElementById('vk-bedrag').value = Number(v.bedrag || 0);
      document.querySelectorAll('input[name="vk-frequentie"]').forEach((r) => {
        r.checked = (r.value === (v.frequentie || 'maandelijks'));
      });
      document.getElementById('vk-start-datum').value = (v.start_datum || '').slice(0, 10);
      document.getElementById('vk-eind-datum').value = (v.eind_datum || '').slice(0, 10);
      document.getElementById('vk-notitie').value = v.notitie || '';
      if (verwBtn) verwBtn.classList.remove('hidden');
    } else {
      if (titelEl) titelEl.textContent = 'Nieuwe vaste kost';
      document.getElementById('vk-label').value = '';
      document.getElementById('vk-type').value = 'verzekering';
      document.getElementById('vk-bedrag').value = '';
      document.querySelectorAll('input[name="vk-frequentie"]').forEach((r) => {
        r.checked = (r.value === 'maandelijks');
      });
      document.getElementById('vk-start-datum').value = new Date().toISOString().slice(0, 10);
      document.getElementById('vk-eind-datum').value = '';
      document.getElementById('vk-notitie').value = '';
      if (verwBtn) verwBtn.classList.add('hidden');
    }

    sheet.classList.remove('hidden');
    sheet.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => sheet.classList.add('is-open'));
  }

  _sluitSheet() {
    const sheet = document.getElementById('sheet-vaste-kost');
    if (!sheet) return;
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    setTimeout(() => sheet.classList.add('hidden'), 280);
  }

  _bind() {
    if (this._gebonden) return;
    this._gebonden = true;

    document.getElementById('vk-toevoegen-knop')?.addEventListener('click', () => this.openSheet());
    document.getElementById('vk-backdrop')?.addEventListener('click', () => this._sluitSheet());
    document.getElementById('vk-opslaan')?.addEventListener('click', () => this._opslaan());
    document.getElementById('vk-verwijder')?.addEventListener('click', () => this._verwijderen());

    // Swipe-handle om de sheet weg te swipen
    const sheet = document.querySelector('#sheet-vaste-kost .modal-sheet');
    if (sheet && typeof Utils.bindSwipeToDismiss === 'function') {
      Utils.bindSwipeToDismiss(sheet, () => this._sluitSheet());
    }
  }

  _opslaan() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) {
      Utils.toast('Selecteer eerst een auto', 'err');
      return;
    }

    const label = document.getElementById('vk-label').value.trim();
    const type = document.getElementById('vk-type').value;
    const bedrag = parseFloat(document.getElementById('vk-bedrag').value);
    const frequentie = document.querySelector('input[name="vk-frequentie"]:checked')?.value || 'maandelijks';
    const startD = document.getElementById('vk-start-datum').value;
    const eindD = document.getElementById('vk-eind-datum').value;
    const notitie = document.getElementById('vk-notitie').value.trim();

    if (!bedrag || bedrag <= 0) {
      Utils.toast('Vul een geldig bedrag in', 'err');
      return;
    }

    const payload = {
      id: this._bewerkenId || Utils.uid(),
      auto_id: auto.id,
      type,
      label: label || (TYPE_LABELS[type] || 'Vaste kost'),
      bedrag: parseFloat(bedrag.toFixed(2)),
      frequentie,
      start_datum: startD ? new Date(startD).toISOString() : new Date().toISOString(),
      eind_datum: eindD ? new Date(eindD).toISOString() : null,
      notitie: notitie || null,
    };

    if (this._bewerkenId) {
      this._db.updateVasteKost(this._bewerkenId, payload);
      Utils.toast('Vaste kost bijgewerkt ✓');
    } else {
      this._db.addVasteKost(payload);
      Utils.toast('Vaste kost toegevoegd ✓');
    }

    this._sluitSheet();
    this.render();
  }

  async _verwijderen() {
    if (!this._bewerkenId) return;
    const ja = await ConfirmModal.toon({
      titel: 'Vaste kost verwijderen?',
      tekst: 'Deze terugkerende kostenpost wordt verwijderd uit je overzicht.',
      bevestigLabel: 'Verwijder',
      gevaarlijk: true,
    });
    if (!ja) return;
    this._db.deleteVasteKost(this._bewerkenId);
    this._sluitSheet();
    this.render();
    Utils.toast('Verwijderd');
  }
}

export default VasteKostenController;
