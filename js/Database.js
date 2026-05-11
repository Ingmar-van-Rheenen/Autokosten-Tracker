// ── Database ──────────────────────────────────────────────────────────────────
import { Utils } from './Utils.js';

const DB_KEY = 'tanklog_v2';
const DB_KEY_OLD = 'autokosten_v1';

export class Database {
  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (!Array.isArray(data.autos)) data.autos = [];
        if (!Array.isArray(data.ritten)) data.ritten = [];
        if (!Array.isArray(data.tankbeurten)) data.tankbeurten = [];
        if (!Array.isArray(data.onderhoud)) data.onderhoud = [];
        return data;
      }

      const oud = localStorage.getItem(DB_KEY_OLD);
      if (oud) {
        const gemigreerd = this._migreer(JSON.parse(oud));
        this.save(gemigreerd);
        return gemigreerd;
      }
    } catch {
      // Corrupte data — start schoon
    }
    return this._leeg();
  }

  save(data) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(data));
    } catch {
      alert('Opslag vol — verwijder oude gegevens om door te gaan.');
      throw new Error('QuotaExceeded');
    }
  }

  verwijderAlles() {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(DB_KEY_OLD);
    localStorage.removeItem('tanklog_lopende_rit');
    localStorage.removeItem('tanklog_cbs_dataset');
    localStorage.removeItem('pwa_banner_dismissed');
  }

  getSmartTracking() {
    return this.load().smart_tracking ?? false;
  }

  setSmartTracking(aan) {
    const d = this.load();
    d.smart_tracking = aan;
    this.save(d);
  }

  getGeselecteerdeAuto() {
    const d = this.load();
    return d.autos.find((a) => a.id === d.geselecteerd) || d.autos[0] || null;
  }

  getAutoRitten(autoId) {
    const d = this.load();
    return d.ritten.filter((r) => r.auto_id === autoId || !r.auto_id);
  }

  getAutoTankbeurten(autoId) {
    const d = this.load();
    return d.tankbeurten.filter((t) => t.auto_id === autoId || !t.auto_id);
  }

  getAutoOnderhoud(autoId) {
    const d = this.load();
    return (d.onderhoud || []).filter((o) => o.auto_id === autoId || !o.auto_id);
  }

  getBetaalverzoekUsername() {
    return this.load().betaalverzoek_username ?? '';
  }

  setBetaalverzoekUsername(username) {
    const d = this.load();
    d.betaalverzoek_username = username;
    this.save(d);
  }

  getRevolutUsername() {
    return this.load().revolut_username ?? '';
  }

  setRevolutUsername(username) {
    const d = this.load();
    d.revolut_username = username;
    this.save(d);
  }

  getPassagiers(autoId) {
    const d = this.load();
    const auto = d.autos.find((a) => a.id === autoId);
    return auto?.passagiers ?? [];
  }

  setPassagiers(autoId, namen) {
    const d = this.load();
    const auto = d.autos.find((a) => a.id === autoId);
    if (!auto) return;
    auto.passagiers = namen;
    this.save(d);
  }

  _leeg() {
    return { naam: '', autos: [], geselecteerd: null, ritten: [], tankbeurten: [], onderhoud: [] };
  }

  _migreer(oud) {
    const id = Utils.uid();
    return {
      naam: '',
      autos: [{
        id,
        naam: 'Auto van Mama',
        merk: '',
        km_per_liter: oud.instellingen?.km_per_liter || 14,
        prijs_per_liter: oud.instellingen?.prijs_per_liter || 2.10,
        emoji: '🚗',
      }],
      geselecteerd: id,
      ritten: (oud.ritten || []).map((r) => ({ ...r, auto_id: id })),
      tankbeurten: (oud.tankbeurten || []).map((t) => ({ ...t, auto_id: id })),
      onderhoud: [],
    };
  }
}
