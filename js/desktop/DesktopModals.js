// ── DesktopModals ────────────────────────────────────────────────────────────
// Centrale controller voor de drie desktop-modals: handmatige rit, tankbeurt
// en vaste kost. Hergebruikt Database direct (geen mobiele controller-flow).
// Opent/sluit met fade + escape-toets, en geeft simpele toast-feedback.

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

export class DesktopModals {
  constructor(db) {
    this._db = db;
    this._vkBewerkenId = null;
    this._actief = null;
    this._gebonden = false;
    this._bind();
  }

  // ── Open API ──────────────────────────────────────────────────────────────
  openRit() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return Utils.toast('Selecteer eerst een auto', 'err');
    const nu = new Date();
    this._setVal('desk-rit-datum', nu.toISOString().slice(0, 10));
    this._setVal('desk-rit-tijd', nu.toTimeString().slice(0, 5));
    this._setVal('desk-rit-km', '');
    this._setVal('desk-rit-bestemming', '');
    this._setVal('desk-rit-kmstand', '');
    this._setVal('desk-rit-notitie', '');
    this._toon('desk-modal-rit');
    setTimeout(() => document.getElementById('desk-rit-km')?.focus(), 220);
  }

  openTank() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return Utils.toast('Selecteer eerst een auto', 'err');
    const elektrisch = auto.type === 'elektrisch';

    document.getElementById('desk-tank-chip').textContent = elektrisch ? 'NIEUWE LAADBEURT' : 'NIEUWE TANKBEURT';
    document.getElementById('desk-tank-titel').textContent = elektrisch ? 'Laadbeurt toevoegen' : 'Tankbeurt toevoegen';
    document.getElementById('desk-tank-lbl-liters').textContent = elektrisch ? 'Geladen kWh' : 'Liters';
    document.getElementById('desk-tank-lbl-prijs').textContent = elektrisch ? 'Prijs per kWh (€)' : 'Prijs per liter (€)';
    document.getElementById('desk-tank-opslaan').textContent =
      elektrisch ? 'Laadbeurt opslaan' : 'Tankbeurt opslaan';

    const standaardPrijs = elektrisch
      ? (auto.prijs_per_kwh || '')
      : (auto.prijs_per_liter || '');

    this._setVal('desk-tank-datum', new Date().toISOString().slice(0, 10));
    this._setVal('desk-tank-liters', '');
    this._setVal('desk-tank-prijs', standaardPrijs);
    this._setVal('desk-tank-kmstand', '');
    this._setVal('desk-tank-notitie', '');
    this._updateTankTotaal();
    this._toon('desk-modal-tank');
    setTimeout(() => document.getElementById('desk-tank-liters')?.focus(), 220);
  }

  openVk(id = null) {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return Utils.toast('Selecteer eerst een auto', 'err');
    this._vkBewerkenId = id;
    const titelEl = document.getElementById('desk-vk-titel');
    const verwBtn = document.getElementById('desk-vk-verwijder');

    if (id) {
      const v = this._db.getAutoVasteKosten(auto.id).find((x) => x.id === id);
      if (!v) return;
      titelEl.textContent = 'Vaste kost bewerken';
      this._setVal('desk-vk-label', v.label || '');
      this._setVal('desk-vk-type', v.type || 'overig');
      this._setVal('desk-vk-bedrag', Number(v.bedrag || 0));
      document.querySelectorAll('input[name="desk-vk-freq"]').forEach((r) => {
        r.checked = (r.value === (v.frequentie || 'maandelijks'));
      });
      this._setVal('desk-vk-start', (v.start_datum || '').slice(0, 10));
      this._setVal('desk-vk-eind', (v.eind_datum || '').slice(0, 10));
      this._setVal('desk-vk-notitie', v.notitie || '');
      verwBtn.classList.remove('hidden');
    } else {
      titelEl.textContent = 'Vaste kost toevoegen';
      this._setVal('desk-vk-label', '');
      this._setVal('desk-vk-type', 'verzekering');
      this._setVal('desk-vk-bedrag', '');
      document.querySelectorAll('input[name="desk-vk-freq"]').forEach((r) => {
        r.checked = (r.value === 'maandelijks');
      });
      this._setVal('desk-vk-start', new Date().toISOString().slice(0, 10));
      this._setVal('desk-vk-eind', '');
      this._setVal('desk-vk-notitie', '');
      verwBtn.classList.add('hidden');
    }

    this._toon('desk-modal-vk');
    setTimeout(() => document.getElementById('desk-vk-label')?.focus(), 220);
  }

  openWidgets(huidigeKeuze, totale, onSave) {
    const lijst = document.getElementById('desk-widgets-toggles');
    if (!lijst) return;
    const aktief = new Set(huidigeKeuze);
    this._widgetOnSave = onSave;

    lijst.innerHTML = totale.map((w) => `
      <li class="desk-widget-toggle ${aktief.has(w.key) ? 'aan' : ''}" data-widget="${w.key}">
        <span class="desk-toggle-naam">${w.label}</span>
        <span class="desk-toggle-knop" aria-hidden="true"></span>
      </li>
    `).join('');

    lijst.querySelectorAll('.desk-widget-toggle').forEach((el) => {
      el.addEventListener('click', () => {
        el.classList.toggle('aan');
      });
    });

    // Markeer welke preset overeenkomt met de huidige keuze (best-effort).
    document.querySelectorAll('#desk-modal-widgets .desk-preset-knop').forEach((b) => b.classList.remove('actief'));

    this._toon('desk-modal-widgets');
  }

  // ── Toon / sluit ──────────────────────────────────────────────────────────
  _toon(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('hidden', 'uit');
    this._actief = m;
  }

  _sluit(m) {
    const modal = m || this._actief;
    if (!modal) return;
    modal.classList.add('uit');
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('uit');
      if (this._actief === modal) this._actief = null;
    }, 180);
  }

  // ── Bind events (één keer) ────────────────────────────────────────────────
  _bind() {
    if (this._gebonden) return;
    this._gebonden = true;

    // Universele sluit-handlers via data-sluit + escape
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-sluit]');
      if (!t) return;
      const modal = t.closest('.desk-modal');
      if (modal) this._sluit(modal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._actief) this._sluit();
    });

    // RIT
    document.getElementById('desk-rit-opslaan')?.addEventListener('click', () => this._opslaanRit());

    // TANK
    document.getElementById('desk-tank-liters')?.addEventListener('input', () => this._updateTankTotaal());
    document.getElementById('desk-tank-prijs')?.addEventListener('input', () => this._updateTankTotaal());
    document.getElementById('desk-tank-opslaan')?.addEventListener('click', () => this._opslaanTank());

    // VK
    document.getElementById('desk-vk-opslaan')?.addEventListener('click', () => this._opslaanVk());
    document.getElementById('desk-vk-verwijder')?.addEventListener('click', () => this._verwijderVk());

    // WIDGETS
    document.getElementById('desk-widgets-opslaan')?.addEventListener('click', () => {
      const keuze = Array.from(document.querySelectorAll('#desk-widgets-toggles .desk-widget-toggle.aan'))
        .map((el) => el.dataset.widget);
      if (typeof this._widgetOnSave === 'function') this._widgetOnSave(keuze);
      this._sluit();
    });
    document.querySelectorAll('#desk-modal-widgets .desk-preset-knop').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#desk-modal-widgets .desk-preset-knop').forEach((b) => b.classList.remove('actief'));
        btn.classList.add('actief');
        const preset = btn.dataset.preset;
        const setKey = this._presetKeys(preset);
        document.querySelectorAll('#desk-widgets-toggles .desk-widget-toggle').forEach((el) => {
          el.classList.toggle('aan', setKey.has(el.dataset.widget));
        });
      });
    });
  }

  _presetKeys(preset) {
    const PRESETS = {
      minimaal: new Set(['saldo', 'actions', 'themas']),
      compleet: new Set(['saldo', 'trend', 'ritten', 'tank', 'vk', 'stats', 'kaart', 'actions', 'themas']),
      reizen:   new Set(['saldo', 'kaart', 'ritten', 'stats', 'actions']),
    };
    return PRESETS[preset] || PRESETS.compleet;
  }

  // ── Opslaan-handlers ──────────────────────────────────────────────────────
  _opslaanRit() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;

    const km = parseFloat(document.getElementById('desk-rit-km').value);
    if (!(km > 0)) {
      Utils.toast('Vul een geldige afstand in', 'err');
      return;
    }

    const datum = document.getElementById('desk-rit-datum').value;
    const tijd = document.getElementById('desk-rit-tijd').value || '12:00';
    const bestemming = document.getElementById('desk-rit-bestemming').value.trim() || null;
    const kmStandRaw = document.getElementById('desk-rit-kmstand').value;
    const kmStand = kmStandRaw ? parseInt(kmStandRaw, 10) : null;
    const notitie = document.getElementById('desk-rit-notitie').value.trim() || null;

    const datumIso = datum
      ? new Date(`${datum}T${tijd}:00`).toISOString()
      : new Date().toISOString();

    this._db.addRit({
      id: Utils.uid(),
      auto_id: auto.id,
      datum: datumIso,
      start: null,
      eind: null,
      km: parseFloat(km.toFixed(2)),
      bestemming,
      notitie,
      km_stand: Number.isFinite(kmStand) ? kmStand : null,
      gps_track: null,
    });

    Utils.toast('Rit opgeslagen ✓');
    this._sluit();
  }

  _updateTankTotaal() {
    const l = parseFloat(document.getElementById('desk-tank-liters')?.value);
    const p = parseFloat(document.getElementById('desk-tank-prijs')?.value);
    const el = document.getElementById('desk-tank-totaal');
    if (!el) return;
    el.textContent = l > 0 && p > 0
      ? '€ ' + (l * p).toFixed(2).replace('.', ',')
      : '€ —';
  }

  _opslaanTank() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;
    const elektrisch = auto.type === 'elektrisch';

    const liters = parseFloat(document.getElementById('desk-tank-liters').value);
    const prijs = parseFloat(document.getElementById('desk-tank-prijs').value);
    if (!(liters > 0) || !(prijs > 0)) {
      Utils.toast(elektrisch ? 'Vul kWh en prijs in' : 'Vul liters en prijs in', 'err');
      return;
    }

    const datum = document.getElementById('desk-tank-datum').value;
    const datumIso = datum
      ? new Date(`${datum}T12:00:00`).toISOString()
      : new Date().toISOString();
    const kmStandRaw = document.getElementById('desk-tank-kmstand').value;
    const kmStand = kmStandRaw ? parseInt(kmStandRaw, 10) : null;
    const notitie = document.getElementById('desk-tank-notitie').value.trim() || null;

    this._db.addTankbeurt({
      id: Utils.uid(),
      auto_id: auto.id,
      datum: datumIso,
      liters,
      prijs_per_liter: elektrisch ? 0 : prijs,
      prijs_per_kwh: elektrisch ? prijs : null,
      totaal: parseFloat((liters * prijs).toFixed(2)),
      bon_foto: null,
      km_stand: Number.isFinite(kmStand) ? kmStand : null,
      notitie,
    });

    Utils.toast(elektrisch ? 'Laadbeurt opgeslagen ✓' : 'Tankbeurt opgeslagen ✓');
    this._sluit();
  }

  _opslaanVk() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;

    const label = document.getElementById('desk-vk-label').value.trim();
    const type = document.getElementById('desk-vk-type').value;
    const bedrag = parseFloat(document.getElementById('desk-vk-bedrag').value);
    const freq = document.querySelector('input[name="desk-vk-freq"]:checked')?.value || 'maandelijks';
    const start = document.getElementById('desk-vk-start').value;
    const eind = document.getElementById('desk-vk-eind').value;
    const notitie = document.getElementById('desk-vk-notitie').value.trim() || null;

    if (!(bedrag > 0)) {
      Utils.toast('Vul een geldig bedrag in', 'err');
      return;
    }

    const payload = {
      auto_id: auto.id,
      type,
      label: label || (TYPE_LABELS[type] || 'Vaste kost'),
      bedrag: parseFloat(bedrag.toFixed(2)),
      frequentie: freq,
      start_datum: start || new Date().toISOString().slice(0, 10),
      eind_datum: eind || null,
      notitie,
    };

    if (this._vkBewerkenId) {
      this._db.updateVasteKost(this._vkBewerkenId, payload);
      Utils.toast('Vaste kost bijgewerkt ✓');
    } else {
      this._db.addVasteKost({ ...payload, id: Utils.uid() });
      Utils.toast('Vaste kost toegevoegd ✓');
    }
    this._sluit();
  }

  async _verwijderVk() {
    if (!this._vkBewerkenId) return;
    const ja = await ConfirmModal.toon({
      titel: 'Vaste kost verwijderen?',
      tekst: 'Deze terugkerende kostenpost wordt verwijderd uit je overzicht.',
      bevestigLabel: 'Verwijder',
      gevaarlijk: true,
    });
    if (!ja) return;
    this._db.deleteVasteKost(this._vkBewerkenId);
    this._vkBewerkenId = null;
    Utils.toast('Verwijderd');
    this._sluit();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _setVal(id, v) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = v ?? '';
  }
}

export default DesktopModals;
