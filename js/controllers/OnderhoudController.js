// ── OnderhoudController ───────────────────────────────────────────────────────
// Beheert het registreren en weergeven van onderhoudskosten per auto.
import { Utils } from '../core/Utils.js';

const TYPE_LABELS = {
  apk: 'APK',
  banden: 'Banden',
  olie: 'Olieverversing',
  remmen: 'Remmen',
  overig: 'Overig',
};

export class OnderhoudController {
  constructor(db) {
    this._db = db;
    this._bindEvents();
  }

  render() {
    const auto = this._db.getGeselecteerdeAuto();
    const items = auto ? this._db.getAutoOnderhoud(auto.id) : [];
    const el = document.getElementById('ond-lijst');
    if (!el) return;

    if (!items.length) {
      el.innerHTML = '<span class="lijst-leeg">Nog geen onderhoud geregistreerd.</span>';
      return;
    }

    el.innerHTML = items.map((o) => `
      <li>
        <div>
          <div class="item-naam">${Utils.esc(TYPE_LABELS[o.type] || o.type)}</div>
          <div class="item-sub">${Utils.datumStr(o.datum)}${o.opmerking ? ' · ' + Utils.esc(o.opmerking) : ''}</div>
        </div>
        <div class="item-acties" data-id="${o.id}">
          <span class="item-val">€ ${o.kosten.toFixed(2).replace('.', ',')}</span>
          <button class="item-del" data-id="${o.id}">✕</button>
        </div>
      </li>`
    ).join('');

    this._bindVerwijder(el);
  }

  _bindEvents() {
    const btn = document.getElementById('btn-ond-save');
    if (btn) btn.addEventListener('click', () => this._voegToe());
  }

  _voegToe() {
    const type = document.getElementById('ond-type').value;
    const kosten = parseFloat(document.getElementById('ond-kosten').value);
    const opmerking = document.getElementById('ond-opmerking').value.trim();

    if (!kosten || kosten <= 0) {
      Utils.toast('Vul een bedrag in.', 'err');
      return;
    }

    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) {
      Utils.toast('Selecteer eerst een auto.', 'err');
      return;
    }

    this._db.addOnderhoud({
      auto_id: auto.id,
      type,
      kosten,
      opmerking,
    });

    document.getElementById('ond-kosten').value = '';
    document.getElementById('ond-opmerking').value = '';

    this.render();
    Utils.toast('Onderhoud opgeslagen ✓');
  }

  _bindVerwijder(el) {
    el.querySelectorAll('.item-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        const acties = btn.closest('.item-acties');
        acties.innerHTML = `
          <span class="item-confirm-lbl">Verwijderen?</span>
          <button class="item-confirm-ja">Ja</button>
          <button class="item-confirm-nee">Nee</button>
        `;
        acties.querySelector('.item-confirm-ja').addEventListener('click', () => this._verwijder(btn.dataset.id));
        acties.querySelector('.item-confirm-nee').addEventListener('click', () => this.render());
      });
    });
  }

  _verwijder(id) {
    this._db.deleteOnderhoud(id);
    this.render();
    Utils.toast('Verwijderd');
  }
}
