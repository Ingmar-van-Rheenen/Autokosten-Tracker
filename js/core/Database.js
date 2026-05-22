// ── Database ──────────────────────────────────────────────────────────────────
// v3 storage. Migreert non-destructief vanuit v2 (tanklog_v2) en v1 (autokosten_v1).
// Elke mutator emit een 'db:updated' event op window zodat controllers reactief
// kunnen re-renderen zonder handmatige callback-chains.

import { Utils } from './Utils.js';

const DB_KEY = 'tanklog_v3';
const DB_KEY_V2 = 'tanklog_v2';
const DB_KEY_V1 = 'autokosten_v1';

export class Database {
  _cache = null; // Ongeldig gemaakt na elke schrijf-operatie

  // ── Load / Save / Wipe ──────────────────────────────────────────────────────

  load() {
    if (this._cache) return this._cache;

    let data;
    try {
      const rawV3 = localStorage.getItem(DB_KEY);
      if (rawV3) {
        const ruw = JSON.parse(rawV3);
        const ruwStr = JSON.stringify(ruw);
        const hydrated = this._hydrate(ruw);
        // Persisteer reparaties (orphans, defaults) eenmalig zodat het niet
        // elke load opnieuw hoeft te gebeuren en exports zijn schoon.
        if (JSON.stringify(hydrated) !== ruwStr) this._schrijf(hydrated);
        data = hydrated;
      } else {
        const rawV2 = localStorage.getItem(DB_KEY_V2);
        if (rawV2) {
          const gemigreerd = this._migreerV2NaarV3(JSON.parse(rawV2));
          const hydrated = this._hydrate(gemigreerd);
          this._schrijf(hydrated);
          // Oude v2-key opruimen — anders raken v2 en v3 uit sync zodra
          // de gebruiker iets wijzigt en bij een latere reload terugleest.
          try { localStorage.removeItem(DB_KEY_V2); } catch {}
          data = hydrated;
        } else {
          const rawV1 = localStorage.getItem(DB_KEY_V1);
          if (rawV1) {
            const v2obj = this._migreerV1NaarV2(JSON.parse(rawV1));
            const v3obj = this._migreerV2NaarV3(v2obj);
            const hydrated = this._hydrate(v3obj);
            this._schrijf(hydrated);
            try {
              localStorage.removeItem(DB_KEY_V1);
              localStorage.removeItem(DB_KEY_V2);
            } catch {}
            data = hydrated;
          }
        }
      }
    } catch {
      // Corrupte data — start schoon.
    }

    this._cache = data || this._leegV3();
    return this._cache;
  }

  save(data) {
    this._schrijf(data);
    this._emit('save', null);
  }

  /**
   * Interne schrijf zonder event-emit. Gebruikt door load() en mutators
   * die hun eigen, specifieke event willen uitzenden.
   */
  _schrijf(data) {
    this._cache = null;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(data));
    } catch {
      alert('Opslag vol — verwijder oude gegevens om door te gaan.');
      throw new Error('QuotaExceeded');
    }
  }

  verwijderAlles() {
    this._cache = null;
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(DB_KEY_V2);
    localStorage.removeItem(DB_KEY_V1);
    localStorage.removeItem('tanklog_lopende_rit');
    localStorage.removeItem('tanklog_cbs_dataset');
    localStorage.removeItem('pwa_banner_dismissed');
    this._emit('verwijderAlles', null);
  }

  // ── Algemene instellingen ───────────────────────────────────────────────────

  getThema() {
    const t = this.load().thema;
    // 'auto' was de v2-default — migreer naar 'klassiek' bij uitlezen.
    if (t === 'auto' || !t) return 'klassiek';
    return t;
  }

  setThema(thema) {
    if (!['klassiek', 'licht', 'donker'].includes(thema)) return;
    const d = this.load();
    d.thema = thema;
    this._schrijf(d);
    this._emit('setThema', { thema });
  }

  getSmartTracking() {
    return this.load().smart_tracking ?? false;
  }

  setSmartTracking(aan) {
    const d = this.load();
    d.smart_tracking = !!aan;
    this._schrijf(d);
    this._emit('setSmartTracking', { aan: d.smart_tracking });
  }

  getBetaalverzoekUsername() {
    return this.load().betaalverzoek_username ?? '';
  }

  setBetaalverzoekUsername(username) {
    const d = this.load();
    d.betaalverzoek_username = username ?? '';
    this._schrijf(d);
    this._emit('setBetaalverzoekUsername', { username: d.betaalverzoek_username });
  }

  getRevolutUsername() {
    return this.load().revolut_username ?? '';
  }

  setRevolutUsername(username) {
    const d = this.load();
    d.revolut_username = username ?? '';
    this._schrijf(d);
    this._emit('setRevolutUsername', { username: d.revolut_username });
  }

  getTikkieHandle() {
    return this.load().tikkie_handle ?? '';
  }

  setTikkieHandle(handle) {
    const d = this.load();
    d.tikkie_handle = handle ?? '';
    this._schrijf(d);
    this._emit('setTikkieHandle', { handle: d.tikkie_handle });
  }

  getStadiaApiKey() {
    return this.load().stadia_api_key ?? '';
  }

  setStadiaApiKey(key) {
    const d = this.load();
    d.stadia_api_key = (key ?? '').trim();
    this._schrijf(d);
    this._emit('setStadiaApiKey', { key: d.stadia_api_key });
  }

  /**
   * Desktop dashboard widget-configuratie. null = default layout (alles aan).
   * Anders een array met widget-keys die zichtbaar moeten zijn.
   */
  getDesktopWidgets() {
    const w = this.load().desktop_widgets;
    return Array.isArray(w) ? w : null;
  }

  setDesktopWidgets(widgets) {
    const d = this.load();
    d.desktop_widgets = Array.isArray(widgets) ? widgets.slice() : null;
    this._schrijf(d);
    this._emit('setDesktopWidgets', { widgets: d.desktop_widgets });
  }

  /**
   * Volgorde van widgets in het desktop-grid. null = default volgorde.
   * Anders een array met widget-keys waarop CSS `order` wordt toegepast.
   */
  getDesktopWidgetOrder() {
    const o = this.load().desktop_widget_order;
    return Array.isArray(o) ? o : null;
  }

  setDesktopWidgetOrder(order) {
    const d = this.load();
    d.desktop_widget_order = Array.isArray(order) ? order.slice() : null;
    this._schrijf(d);
    this._emit('setDesktopWidgetOrder', { order: d.desktop_widget_order });
  }

  // ── Notificatie-instellingen (v3) ─────────────────────────────────────────
  // Een enkel object met alle notificatie-voorkeuren. `null` velden betekenen
  // "niet ingesteld" zodat we onderscheid kunnen maken tussen "uit" en "niet
  // geconfigureerd" (relevant voor first-run UX).
  getNotificatieInstellingen() {
    const d = this.load();
    return {
      aan: !!d.notif_aan,
      deadline_aan: d.notif_deadline_aan !== false, // default true zodra notif_aan = true
      deadline_dagen: Number(d.notif_deadline_dagen) || 14,
      saldo_aan: !!d.notif_saldo_aan,
      saldo_drempel: Number.isFinite(d.notif_saldo_drempel)
        ? Number(d.notif_saldo_drempel) : 25,
    };
  }

  // ── Kaart-instellingen ────────────────────────────────────────────────────
  getKaartHeatmapAan() { return !!this.load().kaart_heatmap_aan; }
  setKaartHeatmapAan(aan) {
    const d = this.load();
    d.kaart_heatmap_aan = !!aan;
    this._schrijf(d);
    this._emit('setKaartHeatmapAan', { aan: d.kaart_heatmap_aan });
  }

  // ── Trash (v3) ────────────────────────────────────────────────────────────
  // Verwijderde records gaan naar `trash` met type + originele payload + datum.
  // Auto-purge na 30 dagen, handmatige recover via instellingen-tab.

  /** Geef alle nog-niet-verlopen prullenbak-items terug (jongste eerst). */
  getTrash() {
    this._pruneOudeTrash();
    return (this.load().trash || []).slice();
  }

  /** Verplaats een item naar de prullenbak. Type bv. 'rit', 'tankbeurt', etc. */
  _naarTrash(type, item) {
    if (!item) return;
    const d = this.load();
    d.trash = d.trash || [];
    d.trash.unshift({
      id: Utils.uid(),
      type,
      datum: new Date().toISOString(),
      item: JSON.parse(JSON.stringify(item)),
    });
    // Houd 'm overzichtelijk: max 200 items en niets ouder dan 30 dagen.
    const grens = Date.now() - 30 * 24 * 60 * 60 * 1000;
    d.trash = d.trash.filter((t) => Date.parse(t.datum) >= grens).slice(0, 200);
    this._schrijf(d);
  }

  /** Pruneer items > 30 dagen oud. Wordt door getTrash() impliciet aangeroepen. */
  _pruneOudeTrash() {
    const d = this.load();
    if (!Array.isArray(d.trash) || !d.trash.length) return;
    const grens = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const voor = d.trash.length;
    d.trash = d.trash.filter((t) => Date.parse(t.datum) >= grens);
    if (d.trash.length !== voor) this._schrijf(d);
  }

  /** Herstel een item uit de prullenbak naar de juiste collectie. */
  herstelUitTrash(trashId) {
    if (!trashId) return false;
    const d = this.load();
    d.trash = d.trash || [];
    const idx = d.trash.findIndex((t) => t.id === trashId);
    if (idx === -1) return false;
    const entry = d.trash[idx];
    if (!entry || !entry.item) return false;

    const arrPerType = {
      rit: 'ritten',
      tankbeurt: 'tankbeurten',
      onderhoud: 'onderhoud',
      vaste_kost: 'vaste_kosten',
      betaling: 'betalingen',
    };
    const veld = arrPerType[entry.type];
    if (!veld) return false;

    d[veld] = d[veld] || [];
    // Voorkom duplicaten op id
    if (entry.item.id && d[veld].some((x) => x.id === entry.item.id)) {
      d.trash.splice(idx, 1);
      this._schrijf(d);
      this._emit('herstelUitTrash', { id: trashId, type: entry.type });
      return true;
    }
    d[veld].unshift(entry.item);
    d.trash.splice(idx, 1);
    this._schrijf(d);
    this._emit('herstelUitTrash', { id: trashId, type: entry.type });
    return true;
  }

  /** Definitief verwijderen uit de prullenbak. */
  purgeTrashItem(trashId) {
    if (!trashId) return;
    const d = this.load();
    d.trash = (d.trash || []).filter((t) => t.id !== trashId);
    this._schrijf(d);
    this._emit('purgeTrashItem', { id: trashId });
  }

  /**
   * Verwijder prullenbak-entries die verwijzen naar een origineel item-id.
   * Gebruikt door de swipe-delete-undo: als de gebruiker de verwijdering
   * terugdraait, hoort het item niet (ook nog) in de prullenbak te staan.
   */
  purgeTrashByItemId(itemId) {
    if (!itemId) return;
    const d = this.load();
    if (!Array.isArray(d.trash) || !d.trash.length) return;
    const voor = d.trash.length;
    d.trash = d.trash.filter((t) => !(t.item && t.item.id === itemId));
    if (d.trash.length !== voor) {
      this._schrijf(d);
      this._emit('purgeTrashItem', { itemId });
    }
  }

  /** Maak de prullenbak helemaal leeg. */
  purgeAlleTrash() {
    const d = this.load();
    d.trash = [];
    this._schrijf(d);
    this._emit('purgeAlleTrash', null);
  }

  setNotificatieInstellingen(patch) {
    if (!patch || typeof patch !== 'object') return;
    const d = this.load();
    if ('aan' in patch) d.notif_aan = !!patch.aan;
    if ('deadline_aan' in patch) d.notif_deadline_aan = !!patch.deadline_aan;
    if ('deadline_dagen' in patch) {
      const n = Number(patch.deadline_dagen);
      d.notif_deadline_dagen = Number.isFinite(n) && n >= 1 ? Math.round(n) : 14;
    }
    if ('saldo_aan' in patch) d.notif_saldo_aan = !!patch.saldo_aan;
    if ('saldo_drempel' in patch) {
      const n = Number(patch.saldo_drempel);
      d.notif_saldo_drempel = Number.isFinite(n) ? n : 25;
    }
    this._schrijf(d);
    this._emit('setNotificatieInstellingen', { patch });
  }

  // ── Auto's ─────────────────────────────────────────────────────────────────

  getGeselecteerdeAuto() {
    const d = this.load();
    const gevonden = d.autos.find((a) => a.id === d.geselecteerd);
    if (gevonden) return gevonden;
    // Stale geselecteerd-id (auto verwijderd of corrupt) — herstel persistent
    // zodat nieuwe ritten/tankbeurten een geldig auto_id meekrijgen.
    const fallback = d.autos[0] || null;
    if (fallback && d.geselecteerd !== fallback.id) {
      d.geselecteerd = fallback.id;
      this._schrijf(d);
    } else if (!fallback && d.geselecteerd !== null) {
      d.geselecteerd = null;
      this._schrijf(d);
    }
    return fallback;
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
    auto.passagiers = Array.isArray(namen) ? namen : [];
    this._schrijf(d);
    this._emit('setPassagiers', { autoId, namen: auto.passagiers });
  }

  // ── Ritten ─────────────────────────────────────────────────────────────────

  getAutoRitten(autoId) {
    const d = this.load();
    return d.ritten.filter((r) => r.auto_id === autoId);
  }

  addRit(rit) {
    if (!rit || typeof rit !== 'object') return;
    const d = this.load();
    const compleet = {
      id: rit.id ?? Utils.uid(),
      auto_id: rit.auto_id ?? d.geselecteerd ?? null,
      datum: rit.datum ?? new Date().toISOString(),
      start: rit.start ?? null,
      eind: rit.eind ?? null,
      km: Number(rit.km) || 0,
      bestemming: rit.bestemming ?? null,
      notitie: rit.notitie ?? null,
      km_stand: rit.km_stand ?? null,
      gps_track: rit.gps_track ?? null,
    };
    d.ritten.unshift(compleet);
    this._schrijf(d);
    this._emit('addRit', compleet);
  }

  updateRit(id, patch) {
    if (!id || !patch) return;
    const d = this.load();
    const idx = d.ritten.findIndex((r) => r.id === id);
    if (idx === -1) return;
    d.ritten[idx] = { ...d.ritten[idx], ...patch, id };
    this._schrijf(d);
    this._emit('updateRit', { id, patch });
  }

  deleteRit(id) {
    if (!id) return;
    const d = this.load();
    const weg = d.ritten.find((r) => r.id === id);
    if (!weg) return;
    d.ritten = d.ritten.filter((r) => r.id !== id);
    this._schrijf(d);
    this._naarTrash('rit', weg);
    this._emit('deleteRit', { id });
  }

  // ── Tankbeurten ────────────────────────────────────────────────────────────

  getAutoTankbeurten(autoId) {
    const d = this.load();
    return d.tankbeurten.filter((t) => t.auto_id === autoId);
  }

  addTankbeurt(tank) {
    if (!tank || typeof tank !== 'object') return;
    const d = this.load();
    const liters = Number(tank.liters) || 0;
    const prijs = Number(tank.prijs_per_liter ?? tank.prijs_per_kwh) || 0;
    const totaal = tank.totaal != null ? Number(tank.totaal) : liters * prijs;
    const autoId = tank.auto_id ?? d.geselecteerd ?? null;
    const auto = autoId ? d.autos.find((a) => a.id === autoId) : null;
    const elektrisch = auto?.type === 'elektrisch';
    const compleet = {
      id: tank.id ?? Utils.uid(),
      auto_id: autoId,
      datum: tank.datum ?? new Date().toISOString(),
      liters,
      // Voor EVs slaan we de waarde apart op als prijs_per_kwh; per-liter
      // analytics blijven daardoor correct.
      prijs_per_liter: elektrisch ? 0 : prijs,
      prijs_per_kwh: elektrisch ? prijs : (tank.prijs_per_kwh ?? null),
      totaal,
      bon_foto: tank.bon_foto ?? null,
      km_stand: tank.km_stand ?? null,
      notitie: tank.notitie ?? null,
    };
    d.tankbeurten.unshift(compleet);
    this._schrijf(d);
    this._emit('addTankbeurt', compleet);
  }

  deleteTankbeurt(id) {
    if (!id) return;
    const d = this.load();
    const weg = d.tankbeurten.find((t) => t.id === id);
    if (!weg) return;
    d.tankbeurten = d.tankbeurten.filter((t) => t.id !== id);
    this._schrijf(d);
    this._naarTrash('tankbeurt', weg);
    this._emit('deleteTankbeurt', { id });
  }

  // ── Onderhoud (eenmalig — bestaand schema) ─────────────────────────────────

  getAutoOnderhoud(autoId) {
    const d = this.load();
    return (d.onderhoud || []).filter((o) => o.auto_id === autoId);
  }

  addOnderhoud(o) {
    if (!o || typeof o !== 'object') return;
    if (!o.auto_id) return;
    const kosten = Number(o.kosten);
    if (!(kosten > 0)) return;
    const d = this.load();
    const compleet = {
      id: o.id ?? Utils.uid(),
      auto_id: o.auto_id,
      datum: o.datum ?? new Date().toISOString(),
      type: o.type ?? 'overig',
      kosten: parseFloat(kosten.toFixed(2)),
      opmerking: typeof o.opmerking === 'string' ? o.opmerking : '',
    };
    d.onderhoud = d.onderhoud || [];
    d.onderhoud.unshift(compleet);
    this._schrijf(d);
    this._emit('addOnderhoud', compleet);
  }

  deleteOnderhoud(id) {
    if (!id) return;
    const d = this.load();
    d.onderhoud = d.onderhoud || [];
    const weg = d.onderhoud.find((o) => o.id === id);
    if (!weg) return;
    d.onderhoud = d.onderhoud.filter((o) => o.id !== id);
    this._schrijf(d);
    this._naarTrash('onderhoud', weg);
    this._emit('deleteOnderhoud', { id });
  }

  // ── Vaste kosten (NEW v3) ──────────────────────────────────────────────────

  getAutoVasteKosten(autoId) {
    const d = this.load();
    return (d.vaste_kosten || []).filter((v) => v.auto_id === autoId);
  }

  addVasteKost(v) {
    if (!v || typeof v !== 'object') return;
    if (!v.auto_id) return;
    const bedrag = Number(v.bedrag);
    if (!(bedrag > 0)) return;
    if (!['maandelijks', 'jaarlijks'].includes(v.frequentie)) return;

    const d = this.load();
    const compleet = {
      id: v.id ?? Utils.uid(),
      auto_id: v.auto_id,
      type: v.type ?? 'overig',
      label: v.label ?? '',
      bedrag,
      frequentie: v.frequentie,
      start_datum: v.start_datum ?? new Date().toISOString(),
      eind_datum: v.eind_datum ?? null,
      notitie: v.notitie ?? null,
    };
    d.vaste_kosten = d.vaste_kosten || [];
    d.vaste_kosten.unshift(compleet);
    this._schrijf(d);
    this._emit('addVasteKost', compleet);
  }

  updateVasteKost(id, patch) {
    if (!id || !patch) return;
    const d = this.load();
    d.vaste_kosten = d.vaste_kosten || [];
    const idx = d.vaste_kosten.findIndex((v) => v.id === id);
    if (idx === -1) return;
    const samen = { ...d.vaste_kosten[idx], ...patch, id };
    // Lichte validatie op critical fields wanneer ze meeveranderen.
    if (patch.bedrag != null && !(Number(patch.bedrag) > 0)) return;
    if (patch.frequentie && !['maandelijks', 'jaarlijks'].includes(patch.frequentie)) return;
    d.vaste_kosten[idx] = samen;
    this._schrijf(d);
    this._emit('updateVasteKost', { id, patch });
  }

  deleteVasteKost(id) {
    if (!id) return;
    const d = this.load();
    d.vaste_kosten = d.vaste_kosten || [];
    const weg = d.vaste_kosten.find((v) => v.id === id);
    if (!weg) return;
    d.vaste_kosten = d.vaste_kosten.filter((v) => v.id !== id);
    this._schrijf(d);
    this._naarTrash('vaste_kost', weg);
    this._emit('deleteVasteKost', { id });
  }

  // ── Betalingen (NEW v3) ────────────────────────────────────────────────────

  getAutoBetalingen(autoId) {
    const d = this.load();
    return (d.betalingen || []).filter((b) => b.auto_id === autoId);
  }

  addBetaling(b) {
    if (!b || typeof b !== 'object') return;
    if (!b.auto_id) return;
    // van/naar zijn verplichte strings — saldo-richting wordt at read-time bepaald.
    const van = typeof b.van === 'string' ? b.van.trim() : '';
    const naar = typeof b.naar === 'string' ? b.naar.trim() : '';
    if (!van || !naar) return;
    const bedrag = Number(b.bedrag);
    if (!Number.isFinite(bedrag) || bedrag === 0) return;

    const d = this.load();
    const compleet = {
      id: b.id ?? Utils.uid(),
      auto_id: b.auto_id,
      datum: b.datum ?? new Date().toISOString(),
      bedrag,
      van,
      naar,
      methode: b.methode ?? 'overig',
      notitie: b.notitie ?? null,
    };
    d.betalingen = d.betalingen || [];
    d.betalingen.unshift(compleet);
    this._schrijf(d);
    this._emit('addBetaling', compleet);
  }

  deleteBetaling(id) {
    if (!id) return;
    const d = this.load();
    d.betalingen = d.betalingen || [];
    const weg = d.betalingen.find((b) => b.id === id);
    if (!weg) return;
    d.betalingen = d.betalingen.filter((b) => b.id !== id);
    this._schrijf(d);
    this._naarTrash('betaling', weg);
    this._emit('deleteBetaling', { id });
  }

  // ── Per-auto reset ─────────────────────────────────────────────────────────

  resetAuto(autoId) {
    if (!autoId) return;
    const d = this.load();
    d.ritten = (d.ritten || []).filter((r) => r.auto_id !== autoId);
    d.tankbeurten = (d.tankbeurten || []).filter((t) => t.auto_id !== autoId);
    d.onderhoud = (d.onderhoud || []).filter((o) => o.auto_id !== autoId);
    d.vaste_kosten = (d.vaste_kosten || []).filter((v) => v.auto_id !== autoId);
    d.betalingen = (d.betalingen || []).filter((b) => b.auto_id !== autoId);
    this._schrijf(d);
    this._emit('resetAuto', { autoId });
  }

  // ── Event helper ───────────────────────────────────────────────────────────

  _emit(mutator, payload) {
    try {
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('db:updated', {
          detail: { mutator, payload },
        }));
      }
    } catch {
      // Stilzwijgend negeren — events zijn aanvullend, niet kritiek.
    }
  }

  // ── Defaults & migraties ───────────────────────────────────────────────────

  _leegV3() {
    return {
      versie: 3,
      thema: 'klassiek',
      naam: '',
      autos: [],
      geselecteerd: null,
      ritten: [],
      tankbeurten: [],
      onderhoud: [],
      vaste_kosten: [],
      betalingen: [],
      smart_tracking: false,
      betaalverzoek_username: '',
      revolut_username: '',
      tikkie_handle: '',
      desktop_widgets: null,
      desktop_widget_order: null,
      notif_aan: false,
      notif_deadline_aan: true,
      notif_deadline_dagen: 14,
      notif_saldo_aan: false,
      notif_saldo_drempel: 25,
      kaart_heatmap_aan: false,
      trash: [],
    };
  }

  /**
   * Hydrate vult ontbrekende velden aan zodat oudere v3-saves zonder
   * later toegevoegde velden niet crashen. Gebruikt op elke load.
   */
  _hydrate(data) {
    if (!data || typeof data !== 'object') return this._leegV3();
    // Toekomstige v4-saves blijven v4; alleen ontbrekende/oudere velden
    // worden op 3 gezet om silent-downgrade-corruptie te voorkomen.
    if (typeof data.versie !== 'number' || data.versie < 3) data.versie = 3;
    // 'auto' is een v2-restant en wordt naar 'klassiek' gemigreerd.
    if (data.thema === 'auto') data.thema = 'klassiek';
    if (!['klassiek', 'licht', 'donker'].includes(data.thema)) data.thema = 'klassiek';
    if (typeof data.naam !== 'string') data.naam = '';
    if (!Array.isArray(data.autos)) data.autos = [];
    if (data.geselecteerd === undefined) data.geselecteerd = null;
    if (!Array.isArray(data.ritten)) data.ritten = [];
    if (!Array.isArray(data.tankbeurten)) data.tankbeurten = [];
    if (!Array.isArray(data.onderhoud)) data.onderhoud = [];
    if (!Array.isArray(data.vaste_kosten)) data.vaste_kosten = [];
    if (!Array.isArray(data.betalingen)) data.betalingen = [];
    if (typeof data.smart_tracking !== 'boolean') data.smart_tracking = !!data.smart_tracking;
    if (typeof data.betaalverzoek_username !== 'string') data.betaalverzoek_username = '';
    if (typeof data.revolut_username !== 'string') data.revolut_username = '';
    if (typeof data.tikkie_handle !== 'string') data.tikkie_handle = '';
    if (data.desktop_widgets !== null && !Array.isArray(data.desktop_widgets)) data.desktop_widgets = null;
    if (data.desktop_widget_order !== null && !Array.isArray(data.desktop_widget_order)) data.desktop_widget_order = null;
    if (typeof data.notif_aan !== 'boolean') data.notif_aan = false;
    if (typeof data.notif_deadline_aan !== 'boolean') data.notif_deadline_aan = true;
    if (!Number.isFinite(data.notif_deadline_dagen)) data.notif_deadline_dagen = 14;
    if (typeof data.notif_saldo_aan !== 'boolean') data.notif_saldo_aan = false;
    if (!Number.isFinite(data.notif_saldo_drempel)) data.notif_saldo_drempel = 25;
    if (typeof data.kaart_heatmap_aan !== 'boolean') data.kaart_heatmap_aan = false;
    if (!Array.isArray(data.trash)) data.trash = [];

    // Item-niveau defaults voor nieuwe v3-velden — idempotent.
    data.ritten = data.ritten.map((r) => ({
      ...r,
      notitie: r.notitie ?? null,
      km_stand: r.km_stand ?? null,
      gps_track: r.gps_track ?? null,
    }));
    data.tankbeurten = data.tankbeurten.map((t) => ({
      ...t,
      bon_foto: t.bon_foto ?? null,
      km_stand: t.km_stand ?? null,
      notitie: t.notitie ?? null,
    }));

    this._repareerOrphans(data);
    return data;
  }

  /**
   * Eénmalige reparatie voor records zonder auto_id of met een auto_id die
   * niet (meer) bestaat. Worden toegewezen aan d.geselecteerd of de eerste
   * auto. Voorkomt dat oude records aan elke auto plakken in get*-filters.
   * Idempotent — daarna verandert er niets meer.
   */
  _repareerOrphans(data) {
    if (!Array.isArray(data.autos) || !data.autos.length) return;
    const bestaande = new Set(data.autos.map((a) => a.id));
    const fallback = bestaande.has(data.geselecteerd) ? data.geselecteerd : data.autos[0].id;
    const reparaar = (lijst) => {
      let veranderd = false;
      const nieuw = (lijst || []).map((it) => {
        if (!it || typeof it !== 'object') return it;
        if (!it.auto_id || !bestaande.has(it.auto_id)) {
          veranderd = true;
          return { ...it, auto_id: fallback };
        }
        return it;
      });
      return { lijst: nieuw, veranderd };
    };
    const r = reparaar(data.ritten);
    const t = reparaar(data.tankbeurten);
    const o = reparaar(data.onderhoud);
    if (r.veranderd) data.ritten = r.lijst;
    if (t.veranderd) data.tankbeurten = t.lijst;
    if (o.veranderd) data.onderhoud = o.lijst;
  }

  /**
   * Non-destructieve migratie v2 → v3. Kopieert alle bestaande velden,
   * vult nieuwe v3-velden met sensible defaults.
   */
  _migreerV2NaarV3(v2) {
    if (!v2 || typeof v2 !== 'object') return this._leegV3();
    return {
      versie: 3,
      thema: 'klassiek',
      naam: v2.naam ?? '',
      autos: Array.isArray(v2.autos) ? v2.autos : [],
      geselecteerd: v2.geselecteerd ?? null,
      ritten: (Array.isArray(v2.ritten) ? v2.ritten : []).map((r) => ({
        ...r,
        notitie: r.notitie ?? null,
        km_stand: r.km_stand ?? null,
        gps_track: r.gps_track ?? null,
      })),
      tankbeurten: (Array.isArray(v2.tankbeurten) ? v2.tankbeurten : []).map((t) => ({
        ...t,
        bon_foto: t.bon_foto ?? null,
        km_stand: t.km_stand ?? null,
        notitie: t.notitie ?? null,
      })),
      onderhoud: Array.isArray(v2.onderhoud) ? v2.onderhoud : [],
      vaste_kosten: Array.isArray(v2.vaste_kosten) ? v2.vaste_kosten : [],
      betalingen: Array.isArray(v2.betalingen) ? v2.betalingen : [],
      smart_tracking: !!v2.smart_tracking,
      betaalverzoek_username: v2.betaalverzoek_username ?? '',
      revolut_username: v2.revolut_username ?? '',
      tikkie_handle: v2.tikkie_handle ?? '',
    };
  }

  /**
   * Migratie v1 → v2 (legacy, behouden uit oude codebase). Output gaat
   * vervolgens door _migreerV2NaarV3 zodat de v3-chain compleet is.
   */
  _migreerV1NaarV2(oud) {
    const id = Utils.uid();
    return {
      naam: typeof oud?.naam === 'string' ? oud.naam : '',
      autos: [{
        id,
        naam: oud?.instellingen?.auto_naam || oud?.auto_naam || 'Mijn auto',
        merk: oud?.instellingen?.merk || '',
        km_per_liter: oud?.instellingen?.km_per_liter || 14,
        prijs_per_liter: oud?.instellingen?.prijs_per_liter || 2.10,
        emoji: '🚗',
      }],
      geselecteerd: id,
      ritten: (oud?.ritten || []).map((r) => ({ ...r, auto_id: id })),
      tankbeurten: (oud?.tankbeurten || []).map((t) => ({ ...t, auto_id: id })),
      onderhoud: [],
    };
  }

  // ── Auto verwijderen ───────────────────────────────────────────────────────

  /**
   * Verwijder een auto inclusief al zijn ritten, tankbeurten, onderhoud,
   * vaste kosten en betalingen. Promote de eerste resterende auto naar
   * geselecteerd als de verwijderde auto actief was.
   */
  deleteAuto(autoId) {
    if (!autoId) return;
    const d = this.load();
    const idx = d.autos.findIndex((a) => a.id === autoId);
    if (idx === -1) return;
    d.autos.splice(idx, 1);
    d.ritten = (d.ritten || []).filter((r) => r.auto_id !== autoId);
    d.tankbeurten = (d.tankbeurten || []).filter((t) => t.auto_id !== autoId);
    d.onderhoud = (d.onderhoud || []).filter((o) => o.auto_id !== autoId);
    d.vaste_kosten = (d.vaste_kosten || []).filter((v) => v.auto_id !== autoId);
    d.betalingen = (d.betalingen || []).filter((b) => b.auto_id !== autoId);
    if (d.geselecteerd === autoId) {
      d.geselecteerd = d.autos[0]?.id ?? null;
    }
    this._schrijf(d);
    this._emit('deleteAuto', { autoId });
  }
}
