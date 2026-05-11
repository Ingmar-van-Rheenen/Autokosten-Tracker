// ── TankController ────────────────────────────────────────────────────────────
// Beheert het toevoegen, verwijderen en renderen van tankbeurten.
import { Utils } from './Utils.js';

export class TankController {
  constructor(db, onUpdate) {
    this._db = db;
    this._onUpdate = onUpdate;

    this._bindEvents();
  }

  laadStandaard() {
    const auto = this._db.getGeselecteerdeAuto();
    const inp = document.getElementById('tank-prijs');
    const suggestieEl = document.getElementById('tank-prijs-suggestie');
    const elektrisch = auto?.type === 'elektrisch';

    const litersLbl = document.getElementById('tank-liters-lbl');
    const prijsLbl = document.getElementById('tank-prijs-lbl');
    const sectieLbl = document.getElementById('tank-sectie-lbl');
    const tankBtn = document.getElementById('btn-tank');
    if (litersLbl) litersLbl.textContent = elektrisch ? 'Geladen kWh' : 'Aantal liters';
    if (prijsLbl) prijsLbl.textContent = elektrisch ? 'Prijs per kWh (€)' : 'Prijs per liter (€)';
    if (sectieLbl) sectieLbl.textContent = elektrisch ? 'LAADBEURT TOEVOEGEN' : 'TANKBEURT TOEVOEGEN';
    if (tankBtn) tankBtn.textContent = elektrisch ? 'Laadbeurt opslaan' : 'Opslaan';

    if (auto) inp.value = elektrisch ? (auto.prijs_per_kwh || '') : auto.prijs_per_liter;
    this._updateTotaal();

    if (suggestieEl && auto) {
      const tankbeurten = this._db.getAutoTankbeurten(auto.id);
      const standaard = elektrisch ? auto.prijs_per_kwh : auto.prijs_per_liter;
      const prijs = tankbeurten.length ? tankbeurten[0].prijs_per_liter : standaard;
      const eenheid = elektrisch ? 'kWh' : 'L';

      suggestieEl.textContent = `Laatste prijs: € ${(prijs || 0).toFixed(elektrisch ? 2 : 3).replace('.', ',')} / ${eenheid}`;
      suggestieEl._suggestieWaarde = prijs;
      suggestieEl.classList.remove('hidden');
    }
  }

  render() {
    const auto = this._db.getGeselecteerdeAuto();
    const elektrisch = auto?.type === 'elektrisch';
    const tank = auto ? this._db.getAutoTankbeurten(auto.id) : [];
    const el = document.getElementById('tank-lijst');

    if (!tank.length) {
      el.innerHTML = '<div class="lijst-leeg-blok"><div class="lijst-leeg-icoon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14"/><path d="M3 22h12"/><path d="M15 8h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h0v5a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2v-2"/><path d="M7 10h4"/></svg></div><div class="lijst-leeg-titel">Nog geen tankbeurten</div><div class="lijst-leeg-sub">Voeg je eerste tankbeurt toe hierboven.</div></div>';
      return;
    }

    el.innerHTML = tank.map((t) => `
      <li>
        <div>
          <div class="item-naam">${t.liters.toFixed(2).replace('.', ',')} ${elektrisch ? 'kWh' : 'liter'}</div>
          <div class="item-sub">${Utils.datumStr(t.datum)} · €${t.prijs_per_liter.toFixed(elektrisch ? 2 : 3)}/${elektrisch ? 'kWh' : 'L'}</div>
        </div>
        <div class="item-acties" data-id="${t.id}">
          <span class="item-val">€ ${t.totaal.toFixed(2).replace('.', ',')}</span>
          <button class="item-del" data-id="${t.id}">✕</button>
        </div>
      </li>`
    ).join('');

    el.querySelectorAll('.item-del').forEach((btn) => {
      btn.addEventListener('click', () => this._vraagVerwijder(btn));
    });
  }

  _bindEvents() {
    document.getElementById('tank-liters').addEventListener('input', () => this._updateTotaal());
    document.getElementById('tank-prijs').addEventListener('input', () => this._updateTotaal());
    document.getElementById('btn-tank').addEventListener('click', () => this._voegToe());

    const suggestieEl = document.getElementById('tank-prijs-suggestie');
    if (suggestieEl) {
      suggestieEl.addEventListener('click', () => {
        const waarde = suggestieEl._suggestieWaarde;
        if (!waarde) return;
        const elektrisch = this._db.getGeselecteerdeAuto()?.type === 'elektrisch';
        document.getElementById('tank-prijs').value = waarde.toFixed(elektrisch ? 2 : 3);
        this._updateTotaal();
      });
    }
  }

  _updateTotaal() {
    const l = parseFloat(document.getElementById('tank-liters').value);
    const p = parseFloat(document.getElementById('tank-prijs').value);
    document.getElementById('tank-totaal').textContent =
      l > 0 && p > 0 ? '€ ' + (l * p).toFixed(2).replace('.', ',') : '€ —';
  }

  _voegToe() {
    const liters = parseFloat(document.getElementById('tank-liters').value);
    const prijs = parseFloat(document.getElementById('tank-prijs').value);
    if (!liters || liters <= 0 || !prijs || prijs <= 0) {
      Utils.toast('Vul liters en prijs in.', 'err');
      return;
    }

    const auto = this._db.getGeselecteerdeAuto();
    const elektrisch = auto?.type === 'elektrisch';
    const d = this._db.load();
    d.tankbeurten.unshift({
      id: Utils.uid(),
      auto_id: auto?.id,
      datum: new Date().toISOString(),
      liters,
      prijs_per_liter: prijs,
      totaal: parseFloat((liters * prijs).toFixed(2)),
    });
    this._db.save(d);

    document.getElementById('tank-liters').value = '';
    document.getElementById('tank-totaal').textContent = '€ —';

    this.render();
    this._onUpdate();
    Utils.toast(elektrisch ? 'Laadbeurt opgeslagen ✓' : 'Tankbeurt opgeslagen ✓');
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
    d.tankbeurten = d.tankbeurten.filter((t) => t.id !== id);
    this._db.save(d);
    this.render();
    this._onUpdate();
    Utils.toast('Tankbeurt verwijderd');
  }
}
