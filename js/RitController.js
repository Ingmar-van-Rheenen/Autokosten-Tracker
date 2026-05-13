// ── RitController ─────────────────────────────────────────────────────────────
// Beheert de volledige rit-staat machine: idle → bezig → confirm → idle
import { Utils } from './Utils.js';

/** @typedef {'idle'|'bezig'|'confirm'} RitState */

const LOPENDE_RIT_KEY = 'tanklog_lopende_rit';
const LIVE_INTERVAL_MS = 30_000;
const MIN_GPS_DELTA_KM = 0.05; // negeer GPS-ruis < 50 m


export class RitController {
  constructor(db, geo, kaart, onUpdate) {
    this._db = db;
    this._geo = geo;
    this._kaart = kaart;
    this._onUpdate = onUpdate;

    /** @type {RitState} */
    this._state = 'idle';
    this._ritStart = null;
    this._ritEind = null;
    this._ritKm = null;
    this._bestemming = null;
    this._cachedGps = null;
    this._liveIntervalId = null;
    this._watchId = null;
    this._wakeLock = null;
    this._laasteGpsPos = null;
    this._track = [];           // v3: GPS-polyline (alleen bij smart-tracking)
    this._startTijdMs = null;   // v3: voor elapsed-timer
    this._elapsedIntervalId = null;

    this._bindEvents();
  }

  setCachedGps(pos) {
    this._cachedGps = pos;
  }

  // ── State persistentie ────────────────────────────────────────────────────

  _slaStateOp() {
    try {
      if (this._state === 'idle') {
        localStorage.removeItem(LOPENDE_RIT_KEY);
        return;
      }
      const data = { state: this._state, ritStart: this._ritStart, ritKm: this._ritKm };
      if (this._state === 'confirm') {
        data.ritEind = this._ritEind;
        data.bestemming = this._bestemming;
      }
      localStorage.setItem(LOPENDE_RIT_KEY, JSON.stringify(data));
    } catch { /* quota bereikt — state gaat verloren bij herstart */ }
  }

  herstelState() {
    const raw = localStorage.getItem(LOPENDE_RIT_KEY);
    if (!raw) return;

    let data;
    try { data = JSON.parse(raw); } catch { localStorage.removeItem(LOPENDE_RIT_KEY); return; }

    this._ritStart = data.ritStart || null;
    this._ritEind = data.ritEind || null;
    this._ritKm = data.ritKm ?? null;
    this._bestemming = data.bestemming || null;

    if (data.state === 'bezig') {
      this._ritKm = data.ritKm ?? 0;
      if (this._ritStart) this._kaart.zetStartMarker(this._ritStart);
      document.getElementById('bs-rit-naam').textContent = 'Rit bezig…';
      this._updateBsStats();
      this._setState('bezig');
      this._startLiveTracking();
      Utils.toast('Rit hervat ✓');
    } else if (data.state === 'confirm') {
      document.getElementById('confirm-km').textContent = this._ritKm ? Utils.km(this._ritKm) : '— km';
      document.getElementById('km-override').value = '';
      document.getElementById('rit-notitie').value = '';
      if (this._bestemming) document.getElementById('bs-rit-naam').textContent = `Rit naar ${this._bestemming}`;
      this._setState('confirm');
      Utils.toast('Rit wacht op opslaan ✓');
    }
  }

  // ── Live km-tracking ──────────────────────────────────────────────────────

  _startLiveTracking() {
    this._stopLiveTracking();
    this._laasteGpsPos = this._ritStart;

    if (this._db.getSmartTracking()) {
      this._acquireWakeLock();

      // v3: start de live polyline + track-buffer bij het beginpunt
      this._track = this._ritStart ? [[this._ritStart.lat, this._ritStart.lng]] : [];
      if (this._ritStart && typeof this._kaart.startLivePolyline === 'function') {
        this._kaart.startLivePolyline(this._ritStart);
      }

      this._watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (this._state !== 'bezig') return;
          const nieuw = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (this._laasteGpsPos) {
            const delta = Utils.haversine(this._laasteGpsPos, nieuw);
            if (delta >= MIN_GPS_DELTA_KM) {
              this._ritKm = (this._ritKm || 0) + delta;
              this._laasteGpsPos = nieuw;
              this._track.push([nieuw.lat, nieuw.lng]);
              if (typeof this._kaart.voegLivePuntToe === 'function') {
                this._kaart.voegLivePuntToe(nieuw);
              }
              this._slaStateOp();
              this._updateBsStats();
            }
          } else {
            this._laasteGpsPos = nieuw;
          }
        },
        () => { /* GPS tijdelijk niet beschikbaar */ },
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    } else {
      this._liveIntervalId = setInterval(async () => {
        if (this._state !== 'bezig') return;
        try {
          const pos = await this._geo.getGps();
          if (this._laasteGpsPos) {
            const delta = Utils.haversine(this._laasteGpsPos, pos);
            if (delta >= MIN_GPS_DELTA_KM) {
              this._ritKm = (this._ritKm || 0) + delta;
              this._laasteGpsPos = pos;
              this._slaStateOp();
              this._updateBsStats();
            }
          } else {
            this._laasteGpsPos = pos;
          }
        } catch { /* GPS tijdelijk niet beschikbaar */ }
      }, LIVE_INTERVAL_MS);
    }

    // v3: elapsed-timer in #bs-elapsed (mm:ss). Start vanaf NU.
    this._startTijdMs = Date.now();
    this._tickElapsed();
    this._elapsedIntervalId = setInterval(() => this._tickElapsed(), 1000);
  }

  _tickElapsed() {
    const el = document.getElementById('bs-elapsed');
    if (!el || !this._startTijdMs) return;
    const sec = Math.max(0, Math.floor((Date.now() - this._startTijdMs) / 1000));
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    el.textContent = mm + ':' + ss;
  }

  _stopLiveTracking() {
    if (this._liveIntervalId) {
      clearInterval(this._liveIntervalId);
      this._liveIntervalId = null;
    }
    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
    if (this._elapsedIntervalId) {
      clearInterval(this._elapsedIntervalId);
      this._elapsedIntervalId = null;
    }
    // v3: rond live polyline af en bewaar verzameld track
    if (typeof this._kaart.stopLivePolyline === 'function') {
      const gestopt = this._kaart.stopLivePolyline();
      if (Array.isArray(gestopt) && gestopt.length > this._track.length) this._track = gestopt;
    }
    this._releaseWakeLock();
    this._laasteGpsPos = null;
  }

  async _acquireWakeLock() {
    try {
      this._wakeLock = await navigator.wakeLock?.request('screen');
    } catch { /* wakeLock niet beschikbaar op dit apparaat */ }
  }

  _releaseWakeLock() {
    this._wakeLock?.release().catch(() => {});
    this._wakeLock = null;
  }

  _bindEvents() {
    document.getElementById('btn-start').addEventListener('click', () => this._startRit());
    document.getElementById('btn-stop').addEventListener('click', () => this._stopRit());
    document.getElementById('btn-opslaan').addEventListener('click', () => this._slaOp());
    document.getElementById('btn-annuleer').addEventListener('click', () => this._annuleer());
  }

  _setState(state) {
    this._state = state;

    ['idle', 'bezig', 'confirm'].forEach((s) => {
      const el = document.getElementById('bs-' + s);
      const toon = s === state;
      el.classList.toggle('hidden', !toon);

      if (toon) {
        el.classList.remove('bs-state-enter');
        void el.offsetWidth;
        el.classList.add('bs-state-enter');
        el.addEventListener('animationend', () => {
          el.classList.remove('bs-state-enter');
        }, { once: true });
      }
    });

    document.getElementById('rit-pill').classList.toggle('hidden', state !== 'bezig');
  }

  async _startRit() {
    if (this._state !== 'idle') return;
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) { Utils.toast('Selecteer eerst een auto.', 'err'); return; }

    const btn = document.getElementById('btn-start');
    btn.disabled = true;
    btn.dataset.origText = btn.textContent;
    btn.innerHTML = '<span class="rit-btn-spinner"></span>LOCATIE BEPALEN…';
    this._kaart.reset();

    try {
      this._ritStart = this._cachedGps || await this._geo.getGps();
      this._cachedGps = null;
      this._ritKm = 0;

      this._kaart.zetStartMarker(this._ritStart);
      this._kaart.setView(this._ritStart.lat, this._ritStart.lng, 14);

      document.getElementById('bs-rit-naam').textContent = 'Rit bezig…';
      this._setState('bezig');
      this._slaStateOp();
      this._updateBsStats();
      this._startLiveTracking();
    } catch (e) {
      const msg = e.code === 1 ? 'Locatietoegang geweigerd — check instellingen van je browser.'
        : e.code === 2 ? 'Locatie niet beschikbaar. Probeer opnieuw.'
        : 'GPS te langzaam. Probeer het opnieuw.';
      Utils.toast(msg, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = btn.dataset.origText || 'START RIT';
    }
  }

  async _stopRit() {
    const btn = document.getElementById('btn-stop');
    btn.disabled = true;
    btn.innerHTML = '<span class="rit-btn-spinner"></span>LOCATIE BEPALEN…';

    try {
      this._stopLiveTracking();
      this._ritEind = await this._geo.getGps();

      const smartTracking = this._db.getSmartTracking();

      if (smartTracking) {
        this._kaart.zetEindMarker?.(this._ritEind);
      } else {
        btn.innerHTML = '<span class="rit-btn-spinner"></span>ROUTE BEREKENEN…';
        try {
          const route = await this._geo.osrmRoute(this._ritStart, this._ritEind);
          this._ritKm = route.km;
          this._kaart.toonRoute(this._ritEind, route.coords);
        } catch {
          this._ritKm = this._ritKm || null;
          Utils.toast('Route niet berekend — voer km handmatig in.', 'err');
        }
      }

      const geocodeToken = {};
      this._geocodeToken = geocodeToken;
      this._geo.reverseGeocode(this._ritEind.lat, this._ritEind.lng).then((stad) => {
        if (this._geocodeToken !== geocodeToken) return;
        this._bestemming = stad;
        if (stad) document.getElementById('bs-rit-naam').textContent = `Rit naar ${stad}`;
      });

      document.getElementById('confirm-km').textContent = this._ritKm ? Utils.km(this._ritKm) : '— km';
      document.getElementById('km-override').value = '';
      document.getElementById('rit-notitie').value = '';
      this._setState('confirm');
      this._slaStateOp();
    } catch {
      this._ritEind = null;
      document.getElementById('confirm-km').textContent = this._ritKm ? Utils.km(this._ritKm) : '— km';
      document.getElementById('km-override').value = '';
      document.getElementById('rit-notitie').value = '';
      this._setState('confirm');
      this._slaStateOp();
      Utils.toast('GPS niet beschikbaar — voer km handmatig in.', 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = 'STOP RIT';
    }

  }

  _slaOp() {
    const rawOverride = document.getElementById('km-override').value.replace(',', '.');
    const handmatig = parseFloat(rawOverride);
    const afstand = handmatig > 0 ? handmatig : this._ritKm;
    if (!afstand || afstand <= 0) { Utils.toast('Voer een geldige afstand in.', 'err'); return; }

    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) { Utils.toast('Geen auto geselecteerd.', 'err'); return; }

    const notitie = document.getElementById('rit-notitie').value.trim();
    const kmStandRaw = document.getElementById('rit-km-stand')?.value;
    const kmStand = kmStandRaw ? parseInt(kmStandRaw, 10) : null;

    // v3: bewaar polyline alleen bij smart-tracking (storage-zuinig)
    const gpsTrack = (this._db.getSmartTracking() && Array.isArray(this._track) && this._track.length > 1)
      ? this._track.slice() : null;

    const rit = {
      id: Utils.uid(),
      auto_id: auto.id,
      datum: new Date().toISOString(),
      start: this._ritStart ?? null,
      eind: this._ritEind ?? null,
      km: parseFloat(afstand.toFixed(2)),
      bestemming: this._bestemming ?? null,
      notitie: notitie || null,
      km_stand: Number.isFinite(kmStand) ? kmStand : null,
      gps_track: gpsTrack,
    };

    try {
      if (typeof this._db.addRit === 'function') {
        this._db.addRit(rit);
      } else {
        const d = this._db.load();
        d.ritten.unshift(rit);
        this._db.save(d);
      }
    } catch {
      return; // QuotaExceeded — alert al getoond door Database.save
    }

    this._reset();
    this._onUpdate();
    Utils.toast('Rit opgeslagen ✓');
  }

  _annuleer() {
    this._reset();
  }

  _reset() {
    this._stopLiveTracking();
    this._geocodeToken = null;
    this._ritStart = null;
    this._ritEind = null;
    this._ritKm = null;
    this._bestemming = null;
    this._track = [];
    this._startTijdMs = null;
    const kmStandEl = document.getElementById('rit-km-stand');
    if (kmStandEl) kmStandEl.value = '';
    const elapsedEl = document.getElementById('bs-elapsed');
    if (elapsedEl) elapsedEl.textContent = '00:00';
    this._kaart.reset();
    this._setState('idle');
    this._slaStateOp();
  }

  _updateBsStats() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto || this._ritKm == null) return;

    const ritten = this._db.getAutoRitten(auto.id);
    const tank = this._db.getAutoTankbeurten(auto.id);
    const kosten = auto.type === 'elektrisch'
      ? (this._ritKm / 100) * (auto.kwh_per_100km || 15) * (auto.prijs_per_kwh || 0.25)
      : (this._ritKm / (auto.km_per_liter || 1)) * (auto.prijs_per_liter || 0);
    const { saldo: saldoBase } = Utils.berekenSaldo(ritten, tank, auto);
    const saldo = saldoBase - kosten;

    document.getElementById('bs-km').textContent = Utils.km(this._ritKm);
    document.getElementById('bs-kosten').textContent = Utils.eur(kosten);
    document.getElementById('bs-saldo').textContent = (saldo >= 0 ? '+' : '−') + Utils.eur(saldo);
    document.getElementById('pill-km').textContent = Utils.km(this._ritKm);
  }
}
