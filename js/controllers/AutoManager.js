// ── AutoManager ───────────────────────────────────────────────────────────────
// Beheert auto-selectie, de modal voor nieuw auto toevoegen, en de kaarten-weergave.
import { Utils } from '../core/Utils.js';

const AUTO_EMOJIS = ['🚗', '🚙', '🏎️', '🚐', '🚕', '🚌'];

export class AutoManager {
  constructor(db, onAutoGekozen) {
    this._db = db;
    this._onAutoGekozen = onAutoGekozen;
    this._onSnelleWissel = null;

    this._bindEvents();
  }

  setSnelleWisseler(fn) {
    this._onSnelleWissel = fn;
  }

  toonAutoSelect() {
    const d = this._db.load();

    if (!d.autos.length) {
      this._toonScherm('screen-auto');
      this._toonWizard(d);
      return;
    }

    const naam = d.naam ? `, ${d.naam.toUpperCase()}` : '';
    document.getElementById('auto-greeting').textContent =
      Utils.begroeting() + naam;

    this.renderKaarten();
    this._toonScherm('screen-auto');

    const content = document.querySelector('.auto-content');
    if (content) {
      content.classList.remove('auto-content--animeer');
      void content.offsetWidth;
      content.classList.add('auto-content--animeer');
      setTimeout(() => content.classList.remove('auto-content--animeer'), 1000);
    }
  }

  // ── Wizard: eerste auto instellen ─────────────────────────────────────────

  _toonWizard(d) {
    const naam = d.naam ? `, ${d.naam.toUpperCase()}` : '';
    const content = document.querySelector('.auto-content');
    if (!content) return;

    content.innerHTML = `
      <div class="auto-greeting wiz-el" style="--wiz-d:200ms">${Utils.begroeting()}${naam}</div>
      <h1 class="auto-heading wiz-el" style="--wiz-d:270ms">Laten we je<br>auto instellen.</h1>
      <p class="auto-sub wiz-el" style="--wiz-d:330ms">Snel klaar — even je gegevens invullen</p>

      <div class="wiz-preview wiz-el" id="wiz-preview" style="--wiz-d:400ms">
        <div class="wiz-preview-emoji">🚗</div>
        <div class="wiz-preview-info">
          <div class="wiz-preview-naam" id="wiz-nm-prev">Jouw auto</div>
          <div class="wiz-preview-sub" id="wiz-sub-prev">Vul verbruik in…</div>
        </div>
      </div>

      <div class="wiz-prog-wrap wiz-el" style="--wiz-d:460ms">
        <div class="wiz-prog"><div class="wiz-prog-balk" id="wiz-prog-balk" style="width:25%"></div></div>
        <div class="wiz-prog-lbl" id="wiz-prog-lbl">Stap 1 van 4</div>
      </div>

      <div class="wiz-stappen wiz-el" id="wiz-stappen" style="--wiz-d:510ms">

        <div class="wiz-stap actief" data-stap="0">
          <div class="wiz-stap-vraag">Hoe heet de auto?</div>
          <input type="text" id="wiz-naam-inp" class="wiz-input" placeholder="bijv. Auto van Mama" autocomplete="off" />
        </div>

        <div class="wiz-stap" data-stap="1">
          <div class="wiz-stap-vraag">Merk en model?</div>
          <input type="text" id="wiz-merk-inp" class="wiz-input" placeholder="bijv. Volkswagen Polo" autocomplete="off" />
          <div class="wiz-hint">Optioneel — je kunt dit later aanpassen</div>
        </div>

        <div class="wiz-stap" data-stap="2">
          <div class="wiz-stap-vraag">Brandstoftype?</div>
          <div class="wiz-type-keuze" id="wiz-type-keuze">
            <button class="wiz-type-kaart actief" data-val="benzine">
              <span class="wiz-type-kaart-icoon">⛽</span>
              <span class="wiz-type-kaart-lbl">Benzine / Diesel</span>
            </button>
            <button class="wiz-type-kaart" data-val="elektrisch">
              <span class="wiz-type-kaart-icoon">⚡</span>
              <span class="wiz-type-kaart-lbl">Elektrisch</span>
            </button>
          </div>
          <div class="wiz-hint">Dit bepaalt hoe we je rijkosten berekenen</div>
        </div>

        <div class="wiz-stap" data-stap="3">
          <div class="wiz-stap-vraag" id="wiz-kml-vraag">Verbruik (km per liter)?</div>
          <div class="wiz-chips" id="wiz-kml-chips">
            <button class="wiz-chip" data-val="10">10</button>
            <button class="wiz-chip" data-val="12">12</button>
            <button class="wiz-chip actief" data-val="14">14</button>
            <button class="wiz-chip" data-val="16">16</button>
            <button class="wiz-chip" data-val="18">18</button>
          </div>
          <input type="number" id="wiz-kml-inp" class="wiz-input" step="0.1" min="1" value="14" />
        </div>

        <div class="wiz-stap" data-stap="4">
          <div class="wiz-stap-vraag" id="wiz-prijs-vraag">Brandstofprijs (€ per liter)?</div>
          <div class="wiz-chips" id="wiz-prijs-chips">
            <button class="wiz-chip" data-val="1.90">€ 1,90</button>
            <button class="wiz-chip" data-val="1.99">€ 1,99</button>
            <button class="wiz-chip" data-val="2.10">€ 2,10</button>
            <button class="wiz-chip" data-val="2.20">€ 2,20</button>
          </div>
          <input type="number" id="wiz-prijs-inp" class="wiz-input" step="0.001" min="0" placeholder="of typ hier…" />
        </div>

      </div>

      <div class="wiz-footer wiz-el" style="--wiz-d:560ms">
        <button class="wiz-terug hidden" id="wiz-terug">← Terug</button>
        <button class="wiz-volgende" id="wiz-volgende">Volgende →</button>
      </div>
    `;

    this._bindWizard();
  }

  _bindWizard() {
    let stap = 0;
    const stappen = document.querySelectorAll('.wiz-stap');
    const TOTAAL = stappen.length;

    const getType = () => document.querySelector('#wiz-type-keuze .wiz-type-kaart.actief')?.dataset.val || 'benzine';

    const bindKmlChips = () => {
      document.getElementById('wiz-kml-chips')?.querySelectorAll('.wiz-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('#wiz-kml-chips .wiz-chip').forEach((c) => c.classList.remove('actief'));
          chip.classList.add('actief');
          document.getElementById('wiz-kml-inp').value = chip.dataset.val;
          updatePreview();
        });
      });
    };

    const bindPrijsChips = () => {
      document.getElementById('wiz-prijs-chips')?.querySelectorAll('.wiz-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('#wiz-prijs-chips .wiz-chip').forEach((c) => c.classList.remove('actief'));
          chip.classList.add('actief');
          document.getElementById('wiz-prijs-inp').value = chip.dataset.val;
          updatePreview();
        });
      });
    };

    const updateTypeStappen = (type) => {
      const elektrisch = type === 'elektrisch';

      document.getElementById('wiz-kml-vraag').textContent = elektrisch
        ? 'Verbruik (kWh per 100 km)?' : 'Verbruik (km per liter)?';
      document.getElementById('wiz-kml-chips').innerHTML = elektrisch
        ? '<button class="wiz-chip" data-val="12">12</button><button class="wiz-chip actief" data-val="15">15</button><button class="wiz-chip" data-val="18">18</button><button class="wiz-chip" data-val="20">20</button><button class="wiz-chip" data-val="25">25</button>'
        : '<button class="wiz-chip" data-val="10">10</button><button class="wiz-chip" data-val="12">12</button><button class="wiz-chip actief" data-val="14">14</button><button class="wiz-chip" data-val="16">16</button><button class="wiz-chip" data-val="18">18</button>';
      document.getElementById('wiz-kml-inp').value = elektrisch ? '15' : '14';
      bindKmlChips();

      document.getElementById('wiz-prijs-vraag').textContent = elektrisch
        ? 'Laadprijs (€ per kWh)?' : 'Brandstofprijs (€ per liter)?';
      document.getElementById('wiz-prijs-chips').innerHTML = elektrisch
        ? '<button class="wiz-chip" data-val="0.22">€ 0,22</button><button class="wiz-chip actief" data-val="0.25">€ 0,25</button><button class="wiz-chip" data-val="0.28">€ 0,28</button><button class="wiz-chip" data-val="0.32">€ 0,32</button>'
        : '<button class="wiz-chip" data-val="1.90">€ 1,90</button><button class="wiz-chip" data-val="1.99">€ 1,99</button><button class="wiz-chip actief" data-val="2.10">€ 2,10</button><button class="wiz-chip" data-val="2.20">€ 2,20</button>';
      document.getElementById('wiz-prijs-inp').value = elektrisch ? '0.25' : '';
      bindPrijsChips();

      const emoji = document.querySelector('#wiz-preview .wiz-preview-emoji');
      if (emoji) emoji.textContent = elektrisch ? '⚡' : '🚗';

      updatePreview();
    };

    const updatePreview = () => {
      const nm = document.getElementById('wiz-naam-inp')?.value.trim() || 'Jouw auto';
      const merk = document.getElementById('wiz-merk-inp')?.value.trim() || '';
      const kml = document.getElementById('wiz-kml-inp')?.value || '—';
      const prijs = document.getElementById('wiz-prijs-inp')?.value;
      const elektrisch = getType() === 'elektrisch';

      document.getElementById('wiz-nm-prev').textContent = nm;
      const subDelen = [];
      if (merk) subDelen.push(merk);
      if (elektrisch) {
        subDelen.push(`${kml} kWh/100km`);
        if (prijs) subDelen.push(`€ ${parseFloat(prijs).toFixed(2).replace('.', ',')} /kWh`);
      } else {
        subDelen.push(`1 op ${kml}`);
        if (prijs) subDelen.push(`€ ${parseFloat(prijs).toFixed(2).replace('.', ',')} /L`);
      }
      document.getElementById('wiz-sub-prev').textContent = subDelen.join(' · ');
    };

    const naarStap = (nieuw, richting = 1) => {
      stappen[stap].classList.add(richting > 0 ? 'verlaat-links' : 'verlaat-rechts');
      stappen[stap].classList.remove('actief');
      setTimeout(() => stappen[stap].classList.remove('verlaat-links', 'verlaat-rechts'), 300);

      stap = nieuw;
      stappen[stap].classList.add('actief');

      document.getElementById('wiz-prog-balk').style.width = `${((stap + 1) / TOTAAL) * 100}%`;
      document.getElementById('wiz-prog-lbl').textContent = `Stap ${stap + 1} van ${TOTAAL}`;
      document.getElementById('wiz-terug').classList.toggle('hidden', stap === 0);
      document.getElementById('wiz-volgende').textContent =
        stap === TOTAAL - 1 ? 'Aan de slag →' : 'Volgende →';

      const eersteInput = stappen[stap].querySelector('input');
      setTimeout(() => eersteInput?.focus(), 320);
    };

    // Type-selectie chips
    document.getElementById('wiz-type-keuze')?.querySelectorAll('.wiz-type-kaart').forEach((kaart) => {
      kaart.addEventListener('click', () => {
        document.querySelectorAll('#wiz-type-keuze .wiz-type-kaart').forEach((k) => k.classList.remove('actief'));
        kaart.classList.add('actief');
        updateTypeStappen(kaart.dataset.val);
      });
    });

    // Verbruik + prijs chips (initieel binden)
    bindKmlChips();
    bindPrijsChips();

    // Live preview on input
    document.getElementById('wiz-stappen').addEventListener('input', updatePreview);

    // Enter navigeert door
    document.getElementById('wiz-stappen').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('wiz-volgende')?.click();
    });

    document.getElementById('wiz-volgende').addEventListener('click', () => {
      if (stap === 0) {
        const nm = document.getElementById('wiz-naam-inp').value.trim();
        if (!nm) { document.getElementById('wiz-naam-inp').focus(); return; }
      }
      if (stap < TOTAAL - 1) {
        naarStap(stap + 1, 1);
      } else {
        this._wizardOpslaan();
      }
    });

    document.getElementById('wiz-terug').addEventListener('click', () => {
      if (stap > 0) naarStap(stap - 1, -1);
    });

    // Focus eerste input na stagger
    setTimeout(() => document.getElementById('wiz-naam-inp')?.focus(), 650);
  }

  _wizardOpslaan() {
    const naam = document.getElementById('wiz-naam-inp')?.value.trim();
    const merk = document.getElementById('wiz-merk-inp')?.value.trim() || '';
    const type = document.querySelector('#wiz-type-keuze .wiz-type-kaart.actief')?.dataset.val || 'benzine';
    const kmlVal = parseFloat(document.getElementById('wiz-kml-inp')?.value);
    const prijsVal = parseFloat(document.getElementById('wiz-prijs-inp')?.value);

    if (!naam) { Utils.toast('Voer een naam in.', 'err'); return; }
    if (!(kmlVal > 0)) { Utils.toast('Voer een geldig verbruik in.', 'err'); return; }
    if (!(prijsVal > 0)) {
      Utils.toast(type === 'elektrisch' ? 'Voer een geldige laadprijs in.' : 'Voer een geldige brandstofprijs in.', 'err');
      return;
    }

    const d = this._db.load();
    const nieuw = { id: Utils.uid(), naam, merk, emoji: type === 'elektrisch' ? '⚡' : '🚗' };

    if (type === 'elektrisch') {
      nieuw.type = 'elektrisch';
      nieuw.kwh_per_100km = kmlVal;
      nieuw.prijs_per_kwh = prijsVal;
    } else {
      nieuw.brandstof = 'E10';
      nieuw.km_per_liter = kmlVal;
      nieuw.prijs_per_liter = prijsVal;
    }

    d.autos.push(nieuw);
    d.geselecteerd = nieuw.id;
    this._db.save(d);

    Utils.toast(`${naam} toegevoegd ✓`);
    setTimeout(() => this._onAutoGekozen(), 300);
  }

  setSchermWisselaar(fn) {
    this._toonScherm = fn;
  }

  renderKaarten() {
    const d = this._db.load();
    const el = document.getElementById('auto-kaarten');
    if (!el) return;

    if (!d.autos.length) {
      el.innerHTML =
        '<p style="color:var(--txt-muted);font-size:0.85rem;text-align:center;padding:20px 0">Nog geen auto\'s.</p>';
      return;
    }

    el.innerHTML = d.autos.map((a, i) => `
      <div class="auto-kaart${a.id === d.geselecteerd ? ' selected' : ''}" data-id="${a.id}" style="--kaart-delay:${220 + i * 65}ms">
        <div class="auto-kaart-emoji">${a.emoji || '🚗'}</div>
        <div class="auto-kaart-info">
          <div class="auto-kaart-naam">${Utils.esc(a.naam)}</div>
          <div class="auto-kaart-sub">${a.merk ? Utils.esc(a.merk) + ' · ' : ''}${a.type === 'elektrisch' ? `${a.kwh_per_100km} kWh/100km` : `1 op ${a.km_per_liter}`}</div>
        </div>
        <div class="auto-kaart-radio"></div>
      </div>`
    ).join('');

    el.querySelectorAll('.auto-kaart').forEach((kaart) => {
      kaart.addEventListener('click', () => this._kiesAuto(kaart.dataset.id));
    });
  }

  openModal() {
    document.getElementById('modal-auto').classList.remove('hidden');
  }

  sluitModal() {
    document.getElementById('modal-auto').classList.add('hidden');
    ['auto-naam-inp', 'auto-merk-inp', 'auto-kml-inp', 'auto-prijs-inp'].forEach((id) => {
      document.getElementById(id).value = '';
    });
    const brandstofInp = document.getElementById('auto-brandstof-inp');
    if (brandstofInp) { brandstofInp.selectedIndex = 0; this._updateModalLabels('E10'); }
  }

  _updateModalLabels(brandstof) {
    const elektrisch = brandstof === 'elektrisch';
    const kmlLbl = document.getElementById('auto-kml-lbl');
    const prijsLbl = document.getElementById('auto-prijs-lbl');
    const kmlInp = document.getElementById('auto-kml-inp');
    const prijsInp = document.getElementById('auto-prijs-inp');
    if (kmlLbl) kmlLbl.textContent = elektrisch ? 'Verbruik (kWh per 100 km)' : 'Verbruik (km per liter)';
    if (prijsLbl) prijsLbl.textContent = elektrisch ? 'Laadprijs (€ per kWh)' : 'Standaard brandstofprijs (€/L)';
    if (kmlInp) kmlInp.placeholder = elektrisch ? 'bijv. 15' : 'bijv. 14';
    if (prijsInp) prijsInp.placeholder = elektrisch ? 'bijv. 0.25' : 'bijv. 2.10';
  }

  _bindEvents() {
    document.getElementById('btn-add-auto').addEventListener('click', () => this.openModal());

    document.getElementById('auto-brandstof-inp')?.addEventListener('change', (e) => {
      this._updateModalLabels(e.target.value);
    });

    document.getElementById('modal-auto').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-auto')) this.sluitModal();
    });

    document.getElementById('btn-auto-save').addEventListener('click', () => this._voegAutoToe());
    document.getElementById('btn-wissel').addEventListener('click', () => this._toonWisselPicker());
    document.getElementById('bs-auto-naam').addEventListener('click', () => this._toonWisselPicker());

    // Wissel-picker events
    document.getElementById('modal-auto-wissel').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-auto-wissel')) this._sluitWisselPicker();
    });
    document.getElementById('btn-wissel-add').addEventListener('click', () => {
      this._sluitWisselPicker();
      this.openModal();
    });

    const sheetAuto = document.querySelector('#modal-auto .modal-sheet');
    if (sheetAuto) Utils.bindSwipeToDismiss(sheetAuto, () => this.sluitModal());
    const sheetWissel = document.querySelector('#modal-auto-wissel .modal-sheet');
    if (sheetWissel) Utils.bindSwipeToDismiss(sheetWissel, () => this._sluitWisselPicker());
  }

  _toonWisselPicker() {
    const d = this._db.load();
    const lijst = document.getElementById('wissel-lijst');
    lijst.innerHTML = d.autos.map((a) => `
      <div class="wissel-item${a.id === d.geselecteerd ? ' wissel-item--actief' : ''}" data-id="${a.id}">
        <span class="wissel-item-emoji">${a.emoji || '🚗'}</span>
        <div class="wissel-item-info">
          <div class="wissel-item-naam">${Utils.esc(a.naam)}</div>
          ${a.merk ? `<div class="wissel-item-sub">${Utils.esc(a.merk)}</div>` : ''}
        </div>
        ${a.id === d.geselecteerd ? '<span class="wissel-item-vinkje">✓</span>' : ''}
      </div>`
    ).join('');

    lijst.querySelectorAll('.wissel-item').forEach((item) => {
      item.addEventListener('click', () => this._kiesAutoSnel(item.dataset.id));
    });

    document.getElementById('modal-auto-wissel').classList.remove('hidden');
  }

  _sluitWisselPicker() {
    document.getElementById('modal-auto-wissel').classList.add('hidden');
  }

  _kiesAutoSnel(id) {
    const d = this._db.load();
    if (d.geselecteerd === id) { this._sluitWisselPicker(); return; }
    d.geselecteerd = id;
    this._db.save(d);
    this._sluitWisselPicker();
    this._onSnelleWissel?.();
  }

  _kiesAuto(id) {
    const d = this._db.load();
    d.geselecteerd = id;
    this._db.save(d);
    this.renderKaarten();

    const kaart = document.querySelector('.auto-kaart.selected');
    if (kaart) {
      kaart.classList.add('auto-kaart--gekozen');
    }

    setTimeout(() => this._onAutoGekozen(), 380);
  }

  _voegAutoToe() {
    const naam = document.getElementById('auto-naam-inp').value.trim();
    const merk = document.getElementById('auto-merk-inp').value.trim();
    const brandstof = document.getElementById('auto-brandstof-inp')?.value || 'E10';
    const isElektrisch = brandstof === 'elektrisch';
    const kmlVal = parseFloat(document.getElementById('auto-kml-inp').value);
    const prijsVal = parseFloat(document.getElementById('auto-prijs-inp').value);

    if (!naam || !(kmlVal > 0) || !(prijsVal > 0)) {
      Utils.toast('Vul naam, verbruik en prijs in.', 'err');
      return;
    }

    const d = this._db.load();
    const nieuw = {
      id: Utils.uid(),
      naam,
      merk,
      emoji: isElektrisch ? '⚡' : AUTO_EMOJIS[d.autos.length % AUTO_EMOJIS.length],
    };

    if (isElektrisch) {
      nieuw.type = 'elektrisch';
      nieuw.kwh_per_100km = kmlVal;
      nieuw.prijs_per_kwh = prijsVal;
    } else {
      nieuw.brandstof = brandstof;
      nieuw.km_per_liter = kmlVal;
      nieuw.prijs_per_liter = prijsVal;
    }

    d.autos.push(nieuw);
    if (!d.geselecteerd) d.geselecteerd = nieuw.id;
    this._db.save(d);

    this.sluitModal();
    const appZichtbaar = !document.getElementById('screen-app').classList.contains('hidden');
    if (appZichtbaar) {
      this._onSnelleWissel?.();
    } else {
      this.renderKaarten();
    }
    Utils.toast('Auto toegevoegd ✓');
  }
}
