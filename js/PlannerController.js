// ── PlannerController ─────────────────────────────────────────────────────────
// Berekent de geschatte kosten en saldo-impact van een geplande rit.
import { Utils } from './Utils.js';

export class PlannerController {
  constructor(db, geo) {
    this._db = db;
    this._geo = geo;
    this._startPos = null; // GPS-coördinaten als "Van" via GPS-knop

    this._bindEvents();
  }

  // ── Event binding ─────────────────────────────────────────────────────────

  _bindEvents() {
    document.getElementById('plan-gps-btn').addEventListener('click', () => this._pakGps());
    document.getElementById('plan-add-stop').addEventListener('click', () => this._voegStopToe());
    document.getElementById('plan-bereken').addEventListener('click', () => this._bereken());

    // Reset startPos als de gebruiker handmatig het "Van"-veld aanpast
    document.getElementById('plan-van').addEventListener('input', () => {
      this._startPos = null;
      document.getElementById('plan-van').readOnly = false;
    });
  }

  // ── GPS vertrekpunt ───────────────────────────────────────────────────────

  async _pakGps() {
    const btn = document.getElementById('plan-gps-btn');
    btn.classList.add('plan-gps-loading');
    btn.disabled = true;

    try {
      this._startPos = await this._geo.getGps();
      const vanInp = document.getElementById('plan-van');
      vanInp.value = 'Jouw locatie';
      vanInp.readOnly = true;
      document.getElementById('plan-resultaat').classList.add('hidden');
    } catch {
      Utils.toast('GPS niet beschikbaar', 'err');
    } finally {
      btn.classList.remove('plan-gps-loading');
      btn.disabled = false;
    }
  }

  // ── Stops beheer ──────────────────────────────────────────────────────────

  _voegStopToe() {
    const container = document.getElementById('plan-stops');
    const aantalBestaand = container.querySelectorAll('.plan-stop-rij').length;
    const label = aantalBestaand === 0 ? 'Tussenstop' : `Tussenstop ${aantalBestaand + 1}`;

    const rij = document.createElement('div');
    rij.className = 'planner-stop-rij';
    rij.innerHTML = `
      <input type="text" class="form-input plan-stop" placeholder="${label}" autocomplete="off" />
      <button class="plan-stop-del" title="Verwijder stop">✕</button>
    `;
    rij.querySelector('.plan-stop-del').addEventListener('click', () => {
      rij.remove();
      document.getElementById('plan-resultaat').classList.add('hidden');
    });

    container.appendChild(rij);
    rij.querySelector('.plan-stop').focus();
  }

  // ── Berekening ────────────────────────────────────────────────────────────

  async _bereken() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) { Utils.toast('Selecteer eerst een auto.', 'err'); return; }

    const vanInput = document.getElementById('plan-van').value.trim();
    const bestemmingInput = document.getElementById('plan-bestemming').value.trim();
    const tussenstopInputs = [...document.querySelectorAll('#plan-stops .plan-stop')]
      .map((i) => i.value.trim())
      .filter(Boolean);

    if (!vanInput && !this._startPos) {
      Utils.toast('Voer een vertrekpunt in of gebruik GPS.', 'err'); return;
    }
    if (!bestemmingInput) {
      Utils.toast('Voer minimaal één bestemming in.', 'err'); return;
    }

    const btn = document.getElementById('plan-bereken');
    btn.textContent = 'Berekenen…';
    btn.disabled = true;

    try {
      const punten = [];

      // Vertrekpunt
      if (this._startPos) {
        punten.push(this._startPos);
      } else {
        const pos = await this._geocode(vanInput);
        if (!pos) { Utils.toast(`Adres niet gevonden: ${vanInput}`, 'err'); return; }
        punten.push(pos);
      }

      // Tussenstops (optioneel)
      for (const adres of tussenstopInputs) {
        const pos = await this._geocode(adres);
        if (!pos) { Utils.toast(`Adres niet gevonden: ${adres}`, 'err'); return; }
        punten.push(pos);
      }

      // Bestemming (altijd als laatste punt)
      const bestemmingPos = await this._geocode(bestemmingInput);
      if (!bestemmingPos) { Utils.toast(`Adres niet gevonden: ${bestemmingInput}`, 'err'); return; }
      punten.push(bestemmingPos);

      // OSRM route berekening (ondersteunt meerdere waypoints)
      const coords = punten.map((p) => `${p.lng},${p.lat}`).join(';');
      const r = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`
      );
      if (!r.ok) throw new Error('OSRM verzoek mislukt');
      const data = await r.json();
      if (!data.routes?.length) throw new Error('Geen route gevonden');

      const km = data.routes[0].distance / 1000;

      // Kosten berekening
      const kosten = (km / (auto.km_per_liter || 1)) * (auto.prijs_per_liter || 0);

      // Saldo na rit
      const ritten = this._db.getAutoRitten(auto.id);
      const tank = this._db.getAutoTankbeurten(auto.id);
      const { saldo: saldoNu } = Utils.berekenSaldo(ritten, tank, auto);
      const saldoNa = saldoNu - kosten;

      this._toonResultaat(km, kosten, saldoNu, saldoNa, punten.length);
    } catch (e) {
      Utils.toast('Fout bij berekening: ' + e.message, 'err');
    } finally {
      btn.textContent = 'Bereken route';
      btn.disabled = false;
    }
  }

  _toonResultaat(km, kosten, saldoNu, saldoNa, aantalPunten) {
    const el = document.getElementById('plan-resultaat');
    el.classList.remove('hidden');

    const saldoNaKlasse = saldoNa >= 0 ? 'plan-positief' : 'plan-negatief';
    const saldoNaStr = (saldoNa >= 0 ? '+' : '−') + ' ' + Utils.eur(saldoNa);
    const stops = aantalPunten - 1;

    el.innerHTML = `
      <div class="plan-res-header">RESULTAAT${stops > 1 ? ` · ${stops} STOPS` : ''}</div>
      <div class="plan-res-rij">
        <span class="plan-res-lbl">Afstand</span>
        <span class="plan-res-val">${km.toFixed(1).replace('.', ',')} km</span>
      </div>
      <div class="plan-res-rij">
        <span class="plan-res-lbl">Geschatte kosten</span>
        <span class="plan-res-val">€ ${kosten.toFixed(2).replace('.', ',')}</span>
      </div>
      <div class="plan-res-scheidslijn"></div>
      <div class="plan-res-rij">
        <span class="plan-res-lbl">Huidig saldo</span>
        <span class="plan-res-val ${saldoNu >= 0 ? 'plan-positief' : 'plan-negatief'}">${saldoNu >= 0 ? '+' : '−'} ${Utils.eur(saldoNu)}</span>
      </div>
      <div class="plan-res-rij plan-res-totaal">
        <span class="plan-res-lbl">Saldo na rit</span>
        <span class="plan-res-val ${saldoNaKlasse}">${saldoNaStr}</span>
      </div>
    `;
  }

  // ── Geocoding (adres → coördinaten via Nominatim) ─────────────────────────

  async _geocode(adres) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(adres)}&countrycodes=nl,be&limit=1`,
        { headers: { 'Accept-Language': 'nl' } }
      );
      const data = await r.json();
      if (!data.length) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {
      return null;
    }
  }
}
