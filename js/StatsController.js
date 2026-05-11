// ── StatsController ───────────────────────────────────────────────────────────
// Beheert saldo-berekening, overzicht-statistieken, grafiek en auto-instellingen.
import { Utils } from './Utils.js';
import { InfoOverlay } from './InfoOverlay.js';

export class StatsController {
  constructor(db) {
    this._db = db;
  }

  updateSaldo() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;

    const { betaald, verschuldigd } = this._berekenKosten(auto);
    const saldo = betaald - verschuldigd;

    const el = document.getElementById('saldo-val');
    el.textContent = (saldo >= 0 ? '+' : '−') + Utils.eur(saldo);
    el.className = 'saldo-hero-val ' + (saldo >= 0 ? 'positief' : 'negatief');
    document.getElementById('saldo-uitleg').textContent = saldo >= 0
      ? 'Je hebt meer getankt dan gereden — tegoed'
      : 'Je hebt meer gereden dan getankt — bij te storten';
  }

  updateOverzicht() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;

    const ritten = this._db.getAutoRitten(auto.id);
    const { betaald, verschuldigd, totalKm } = this._berekenKosten(auto);

    document.getElementById('ov-km').textContent = totalKm.toFixed(1).replace('.', ',');
    document.getElementById('ov-ritten').textContent = ritten.length;
    document.getElementById('ov-betaald').textContent = '€ ' + betaald.toFixed(2).replace('.', ',');
    document.getElementById('ov-kosten').textContent = '€ ' + verschuldigd.toFixed(2).replace('.', ',');

    this._renderGrafiek(ritten);
  }

  updateInstellingen() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;

    const d = this._db.load();
    this._renderAutoInstellingen(auto);
    this._renderTrackingInstelling();
    this._renderRevolutInstelling();
    this._renderBetaalverzoekInstelling();

    document.getElementById('inst-naam').value = d.naam || '';
    this._bindNaamOpslaan();
  }

  // ── SVG Grafiek ──────────────────────────────────────────────────────────

  _renderGrafiek(ritten) {
    const el = document.getElementById('grafiek-km');
    if (!el) return;

    const now = new Date();
    const maanden = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('nl-NL', { month: 'short' });
      maanden.push({ key, label, km: 0 });
    }

    ritten.forEach((r) => {
      const d = new Date(r.datum);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const m = maanden.find((m) => m.key === key);
      if (m) m.km += r.km;
    });

    const max = Math.max(...maanden.map((m) => m.km), 1);
    const barW = 32;
    const gap = 12;
    const H = 72;
    const W = (barW + gap) * 6 - gap;

    const bars = maanden.map((m, i) => {
      const h = Math.max(Math.round((m.km / max) * H), m.km > 0 ? 3 : 0);
      const x = i * (barW + gap);
      const val = m.km > 0
        ? `<text x="${x + barW / 2}" y="${H - h - 5}" text-anchor="middle" fill="#5e9464" font-size="9" font-family="monospace">${Math.round(m.km)}</text>`
        : '';
      return `
        <rect x="${x}" y="${H - h}" width="${barW}" height="${h}" fill="#4e7d52" rx="4" opacity="0.85"/>
        ${val}
        <text x="${x + barW / 2}" y="${H + 14}" text-anchor="middle" fill="#7a8a9a" font-size="10" font-family="sans-serif">${m.label}</text>
      `;
    }).join('');

    el.innerHTML = `
      <div class="grafiek-titel">KM PER MAAND</div>
      <svg viewBox="0 0 ${W} ${H + 20}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">${bars}</svg>
    `;
  }

  // ── Auto instellingen ────────────────────────────────────────────────────

  _renderAutoInstellingen(auto) {
    const elektrisch = auto.type === 'elektrisch';
    document.getElementById('auto-inst-form').innerHTML = `
      <div style="font-weight:600;font-size:0.95rem">${Utils.esc(auto.naam)}</div>
      ${elektrisch ? `
      <label class="form-lbl">Verbruik (kWh per 100 km)</label>
      <input type="number" id="inst-kml" class="form-input" step="0.1" min="1" value="${auto.kwh_per_100km}" />
      <label class="form-lbl">Laadprijs (€ per kWh)</label>
      <input type="number" id="inst-prijs" class="form-input" step="0.001" min="0" value="${auto.prijs_per_kwh}" />
      ` : `
      <label class="form-lbl">Verbruik (km per liter)</label>
      <input type="number" id="inst-kml" class="form-input" step="0.1" min="1" value="${auto.km_per_liter}" />
      <label class="form-lbl">Standaard brandstofprijs (€/L)</label>
      <input type="number" id="inst-prijs" class="form-input" step="0.001" min="0" value="${auto.prijs_per_liter}" />
      `}
      <button id="btn-auto-inst-opslaan" class="btn-form-primary">Opslaan</button>
    `;

    document.getElementById('btn-auto-inst-opslaan').addEventListener('click', () => {
      this._slaAutoInstellingenOp();
    });
  }

  _slaAutoInstellingenOp() {
    const kml = parseFloat(document.getElementById('inst-kml').value);
    const prijs = parseFloat(document.getElementById('inst-prijs').value);
    if (!(kml > 0) || !(prijs > 0)) return;

    const d = this._db.load();
    const auto = d.autos.find((a) => a.id === d.geselecteerd);
    if (!auto) return;

    if (auto.type === 'elektrisch') {
      auto.kwh_per_100km = kml;
      auto.prijs_per_kwh = prijs;
    } else {
      auto.km_per_liter = kml;
      auto.prijs_per_liter = prijs;
    }
    this._db.save(d);

    const merk = auto.merk ? auto.merk.toUpperCase() : '';
    const bsEl = document.getElementById('bs-auto-naam');
    if (bsEl) bsEl.textContent = auto.naam.toUpperCase() + (merk ? ' · ' + merk : '');

    Utils.toast('Instellingen opgeslagen ✓');
  }

  _renderTrackingInstelling() {
    const chk = document.getElementById('chk-smart-tracking');
    if (!chk) return;

    chk.checked = this._db.getSmartTracking();

    // Kloon om oude listeners te verwijderen
    const nieuw = chk.cloneNode(true);
    chk.parentNode.replaceChild(nieuw, chk);
    nieuw.checked = this._db.getSmartTracking();

    nieuw.addEventListener('change', () => {
      if (nieuw.checked) {
        // Toon waarschuwing eerst, sla pas op na bevestiging
        nieuw.checked = false;
        InfoOverlay.toon('smart', () => {
          this._db.setSmartTracking(true);
          const el = document.getElementById('chk-smart-tracking');
          if (el) el.checked = true;
        });
      } else {
        this._db.setSmartTracking(false);
      }
    });

    document.getElementById('btn-smart-info')?.addEventListener('click', () => {
      InfoOverlay.toon('smart');
    });
  }

  _renderRevolutInstelling() {
    const inp = document.getElementById('revolut-username-inp');
    if (!inp) return;
    inp.value = this._db.getRevolutUsername();
  }

  _renderBetaalverzoekInstelling() {
    const revolut = document.getElementById('revolut-username-inp');
    const bunqInp = document.getElementById('betaalverzoek-username-inp');
    const saveBtn = document.getElementById('btn-betaalverzoek-save');
    if (!saveBtn) return;

    if (bunqInp) bunqInp.value = this._db.getBetaalverzoekUsername();

    const nieuw = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(nieuw, saveBtn);
    nieuw.addEventListener('click', () => {
      if (revolut) this._db.setRevolutUsername(revolut.value.trim().replace(/^revolut\.me\//i, ''));
      if (bunqInp) this._db.setBetaalverzoekUsername(bunqInp.value.trim().replace(/^bunq\.me\//i, ''));
      Utils.toast('Betaalverzoek instellingen opgeslagen ✓');
    });
  }

  _bindNaamOpslaan() {
    const btn = document.getElementById('btn-naam');
    const nieuw = btn.cloneNode(true);
    btn.parentNode.replaceChild(nieuw, btn);
    nieuw.addEventListener('click', () => {
      const naam = document.getElementById('inst-naam').value.trim();
      const d = this._db.load();
      d.naam = naam;
      this._db.save(d);
      Utils.toast('Naam opgeslagen ✓');
    });
  }

  // ── Berekeningen ─────────────────────────────────────────────────────────

  _berekenKosten(auto) {
    const ritten = this._db.getAutoRitten(auto.id);
    const tank = this._db.getAutoTankbeurten(auto.id);
    const { betaald, verschuldigd, gereden } = Utils.berekenSaldo(ritten, tank, auto);
    return { totalKm: gereden, betaald, verschuldigd };
  }
}
