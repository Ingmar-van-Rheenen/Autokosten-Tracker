// ── RittenController ──────────────────────────────────────────────────────────
// Beheert het renderen, bewerken en verwijderen van ritten.
import { Utils } from './Utils.js';

export class RittenController {
  constructor(db, onUpdate, onDeel) {
    this._db = db;
    this._onUpdate = onUpdate;
    this._onDeel = onDeel;
    this._editId = null;

    this._bindModalEvents();
  }

  render() {
    const auto = this._db.getGeselecteerdeAuto();
    const ritten = auto ? this._db.getAutoRitten(auto.id) : [];
    const el = document.getElementById('ritten-lijst');

    if (!ritten.length) {
      el.innerHTML = '<div class="lijst-leeg-blok"><div class="lijst-leeg-icoon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M5 16V9a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v7"/><path d="M5 12h6m-6 3h4"/></svg></div><div class="lijst-leeg-titel">Nog geen ritten</div><div class="lijst-leeg-sub">Start je eerste rit via de kaart-tab.</div></div>';
      return;
    }

    const kml = auto?.km_per_liter ?? 14;
    const prijs = auto?.prijs_per_liter ?? 2.10;
    const groepen = this._groeperPerMaand(ritten);

    el.innerHTML = groepen.map((g) => {
      const maandKm = g.ritten.reduce((s, r) => s + r.km, 0);
      const items = g.ritten.map((r) => {
        const naam = r.bestemming ? 'Rit naar ' + Utils.esc(r.bestemming) : 'Rit';
        const notitie = r.notitie ? ' · ' + Utils.esc(r.notitie) : '';
        const kosten = (r.km / kml) * prijs;
        return `
          <li>
            <div>
              <div class="item-naam">${naam}</div>
              <div class="item-sub">${Utils.datumStr(r.datum)}${notitie}</div>
              <div class="item-kosten">${Utils.eur(kosten)}</div>
            </div>
            <div class="item-acties" data-id="${r.id}">
              <span class="item-val">${r.km.toFixed(1).replace('.', ',')} km</span>
              <button class="item-deel" data-id="${r.id}" title="Splitsen">↗</button>
              <button class="item-edit" data-id="${r.id}" title="Bewerken">✎</button>
              <button class="item-del" data-id="${r.id}">✕</button>
            </div>
          </li>`;
      }).join('');

      return `
        <li class="maand-header">
          ${g.label}
          <span class="maand-totaal">${maandKm.toFixed(1).replace('.', ',')} km</span>
        </li>
        ${items}`;
    }).join('');

    this._bindActies(el);
  }

  // ── Edit modal ────────────────────────────────────────────────────────────

  _bindModalEvents() {
    document.getElementById('modal-rit-sluit').addEventListener('click', () => this._sluitModal());
    document.getElementById('modal-rit').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-rit')) this._sluitModal();
    });
    document.getElementById('btn-rit-edit-save').addEventListener('click', () => this._slaBewerktOp());

    const sheet = document.querySelector('#modal-rit .modal-sheet');
    if (sheet) Utils.bindSwipeToDismiss(sheet, () => this._sluitModal());
  }

  _openModal(id) {
    const d = this._db.load();
    const rit = d.ritten.find((r) => r.id === id);
    if (!rit) return;

    this._editId = id;
    document.getElementById('rit-edit-km').value = rit.km;
    document.getElementById('rit-edit-notitie').value = rit.notitie || '';
    document.getElementById('modal-rit').classList.remove('hidden');
  }

  _sluitModal() {
    this._editId = null;
    document.getElementById('modal-rit').classList.add('hidden');
  }

  _slaBewerktOp() {
    const km = parseFloat(document.getElementById('rit-edit-km').value);
    const notitie = document.getElementById('rit-edit-notitie').value.trim();
    if (!km || km <= 0) { Utils.toast('Voer een geldige afstand in.', 'err'); return; }

    const d = this._db.load();
    const rit = d.ritten.find((r) => r.id === this._editId);
    if (!rit) return;

    rit.km = parseFloat(km.toFixed(2));
    rit.notitie = notitie || null;
    this._db.save(d);

    this._sluitModal();
    this.render();
    this._onUpdate();
    Utils.toast('Rit bijgewerkt ✓');
  }

  // ── Acties per rij ────────────────────────────────────────────────────────

  _bindActies(el) {
    el.querySelectorAll('.item-deel').forEach((btn) => {
      btn.addEventListener('click', () => this._onDeel?.(btn.dataset.id));
    });
    el.querySelectorAll('.item-edit').forEach((btn) => {
      btn.addEventListener('click', () => this._openModal(btn.dataset.id));
    });
    el.querySelectorAll('.item-del').forEach((btn) => {
      btn.addEventListener('click', () => this._vraagVerwijder(btn));
    });
  }

  _vraagVerwijder(btn) {
    const acties = btn.closest('.item-acties');
    acties.innerHTML = `
      <span class="item-confirm-lbl">Verwijderen?</span>
      <button class="item-confirm-ja">Ja</button>
      <button class="item-confirm-nee">Nee</button>
    `;
    acties.querySelector('.item-confirm-ja').addEventListener('click', () => this._verwijder(btn.dataset.id));
    acties.querySelector('.item-confirm-nee').addEventListener('click', () => this.render());
  }

  _verwijder(id) {
    const d = this._db.load();
    d.ritten = d.ritten.filter((r) => r.id !== id);
    this._db.save(d);
    this.render();
    this._onUpdate();
    Utils.toast('Rit verwijderd');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _groeperPerMaand(ritten) {
    const groepen = {};
    ritten.forEach((r) => {
      const d = new Date(r.datum);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('nl-NL', { month: 'long', year: 'numeric' });
      if (!groepen[key]) groepen[key] = { label, ritten: [] };
      groepen[key].ritten.push(r);
    });
    return Object.values(groepen);
  }
}
