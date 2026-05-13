// ── BetalingenController ──────────────────────────────────────────────────────
// Geschiedenis van afrekeningen tussen jou en je auto-deler.
// Renders #bet-lijst onder de Instellingen-tab + form-binding op #btn-bet-opslaan.
import { Utils } from '../core/Utils.js';
import { ConfirmModal } from '../ui/ConfirmModal.js';

const METHODE_LABEL = {
  tikkie: 'Tikkie',
  bunq: 'bunq',
  revolut: 'Revolut',
  cash: 'Cash',
  overschrijving: 'Overschrijving',
  overig: 'Overig',
};

export class BetalingenController {
  constructor(db) {
    this._db = db;
    this._gebonden = false;
    this._bind();

    // Default datum invullen (vandaag)
    const datumEl = document.getElementById('bet-datum');
    if (datumEl && !datumEl.value) datumEl.value = new Date().toISOString().slice(0, 10);

    window.addEventListener('db:updated', (e) => {
      const m = e?.detail?.mutator || '';
      if (m.includes('Betaling') || m === 'save' || m === 'resetAuto' || m === 'verwijderAlles') {
        this.render();
      }
    });
  }

  render() {
    const auto = this._db.getGeselecteerdeAuto();
    const items = auto ? this._db.getAutoBetalingen(auto.id) : [];
    const lijst = document.getElementById('bet-lijst');
    if (!lijst) return;

    if (!items.length) {
      lijst.innerHTML = `
        <div class="lijst-leeg-blok">
          <div class="lijst-leeg-icoon">
            <svg viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18"/><circle cx="7" cy="7" r="0.5" fill="currentColor"/><circle cx="7" cy="12" r="0.5" fill="currentColor"/><circle cx="7" cy="17" r="0.5" fill="currentColor"/></svg>
          </div>
          <div class="lijst-leeg-titel">Nog geen betalingen</div>
          <div class="lijst-leeg-sub">Hier verschijnen je afrekeningen — handmatig toegevoegd of via de Afrekenen-sheet.</div>
        </div>`;
      return;
    }

    const gesorteerd = [...items].sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

    lijst.innerHTML = gesorteerd.map((b) => {
      const bedrag = Number(b.bedrag || 0).toFixed(2).replace('.', ',');
      const methode = METHODE_LABEL[b.methode] || b.methode || '';
      const methodeKey = Utils.esc(b.methode || 'overig');
      const van = Utils.esc(b.van || '');
      const naar = Utils.esc(b.naar || '');
      const notitie = b.notitie ? `<div class="bet-notitie">${Utils.esc(b.notitie)}</div>` : '';
      return `
        <li class="bet-kaart" data-id="${b.id}">
          <div class="bet-kaart-info">
            <div class="bet-kaart-bedrag">€ ${bedrag}</div>
            <div class="bet-kaart-richting">${van} <span class="bet-kaart-richting-pijl">→</span> ${naar}</div>
            <div class="bet-kaart-datum">${Utils.datumStr(b.datum)}</div>
            ${notitie}
          </div>
          <div class="bet-kaart-rechts">
            <span class="bet-methode-badge" data-methode="${methodeKey}">${Utils.esc(methode)}</span>
            <button class="bet-kaart-del" data-id="${b.id}" aria-label="Verwijder">✕</button>
          </div>
        </li>
      `;
    }).join('');

    lijst.querySelectorAll('.bet-kaart-del').forEach((btn) => {
      btn.addEventListener('click', () => this._bevestigVerwijder(btn.dataset.id));
    });
  }

  voegToe(b) {
    this._db.addBetaling(b);
  }

  delete(id) {
    this._db.deleteBetaling(id);
  }

  _bind() {
    if (this._gebonden) return;
    this._gebonden = true;
    document.getElementById('btn-bet-opslaan')?.addEventListener('click', () => this._opslaan());
  }

  _opslaan() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) {
      Utils.toast('Selecteer eerst een auto', 'err');
      return;
    }

    const bedrag = parseFloat(document.getElementById('bet-bedrag').value);
    const van = document.getElementById('bet-van').value.trim();
    const naar = document.getElementById('bet-naar').value.trim();
    const methode = document.getElementById('bet-methode').value;
    const datum = document.getElementById('bet-datum').value;
    const notitie = document.getElementById('bet-notitie').value.trim();

    if (!bedrag || bedrag <= 0) {
      Utils.toast('Vul een geldig bedrag in', 'err');
      return;
    }
    if (!van || !naar) {
      Utils.toast('Vul "van" en "naar" in', 'err');
      return;
    }

    const payload = {
      id: Utils.uid(),
      auto_id: auto.id,
      datum: datum ? new Date(datum).toISOString() : new Date().toISOString(),
      bedrag: parseFloat(bedrag.toFixed(2)),
      van,
      naar,
      methode,
      notitie: notitie || null,
    };

    this._db.addBetaling(payload);

    document.getElementById('bet-bedrag').value = '';
    document.getElementById('bet-notitie').value = '';

    this.render();
    Utils.toast('Betaling opgeslagen ✓');
  }

  async _bevestigVerwijder(id) {
    const ja = await ConfirmModal.toon({
      titel: 'Betaling verwijderen?',
      tekst: 'Deze afrekening wordt uit de geschiedenis verwijderd.',
      bevestigLabel: 'Verwijder',
      gevaarlijk: true,
    });
    if (!ja) return;
    this._db.deleteBetaling(id);
    this.render();
    Utils.toast('Verwijderd');
  }
}

export default BetalingenController;
