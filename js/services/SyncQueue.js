// ── SyncQueue ─────────────────────────────────────────────────────────────────
// Houdt lokaal een queue bij van wijzigingen die nog naar de Vroom-API moeten.
// Klanten van Database (RitController, TankController, AutoManager) gaan dit
// in komende sprints aanroepen na een succesvolle lokale mutatie. Bij online
// + ingelogde sessie probeert de queue zichzelf leeg te trekken via ApiClient.
// Storage-key: `vroom_sync_queue` (los van de hoofd-DB zodat exports en
// resets duidelijk gescheiden blijven).

import { ApiError } from './ApiClient.js';

const QUEUE_KEY = 'vroom_sync_queue';
const CURSOR_KEY = 'vroom_sync_cursor';
const MAX_ATTEMPTS = 6;

/**
 * @typedef {object} SyncJob
 * @property {string} id - lokale uuid van het queue-item
 * @property {'auto'|'rit'|'tankbeurt'} soort
 * @property {object} record - de payload zoals /sync/push die accepteert
 * @property {number} pogingen
 * @property {number} aangemaakt
 */

export class SyncQueue {
  /**
   * @param {object} deps
   * @param {import('./ApiClient.js').ApiClient} deps.api
   */
  constructor({ api }) {
    this._api = api;
    this._bezig = false;
  }

  // ── Persistente queue-state ─────────────────────────────────────────────────

  /** @returns {SyncJob[]} */
  _lees() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _schrijf(jobs) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(jobs)); } catch {}
  }

  /** @returns {string|null} laatste serverTime-cursor voor pull-delta */
  getCursor() {
    try { return localStorage.getItem(CURSOR_KEY); } catch { return null; }
  }

  setCursor(serverTime) {
    try { localStorage.setItem(CURSOR_KEY, serverTime); } catch {}
  }

  // ── Publieke API ────────────────────────────────────────────────────────────

  /** @returns {number} aantal jobs op de queue */
  grootte() { return this._lees().length; }

  /**
   * Plaats een lokale mutatie op de queue. `record` moet `id` en `updatedAt`
   * (ISO-string) hebben — anders weet de server geen LWW toe te passen.
   * @param {'auto'|'rit'|'tankbeurt'} soort
   * @param {object} record
   */
  enqueue(soort, record) {
    if (!record || !record.id || !record.updatedAt) {
      throw new Error('SyncQueue: record mist id of updatedAt');
    }
    const jobs = this._lees();
    jobs.push({
      id: 'q-' + Math.random().toString(36).slice(2) + Date.now().toString(36),
      soort,
      record,
      pogingen: 0,
      aangemaakt: Date.now(),
    });
    this._schrijf(jobs);
  }

  /** Wis de hele queue (bv. na reset). */
  leeg() { this._schrijf([]); }

  /**
   * Probeer alles op de queue naar de server te pushen. Items waarbij de
   * server een 4xx (geen netwerk-fout) geeft worden gedropt om infinite
   * retries te voorkomen; netwerk-fouten houden ze op de queue staan.
   * Re-entrant veilig: een tweede flush() tijdens een bezige flush no-opt.
   * @returns {Promise<{verzonden:number, mislukt:number, gedropt:number}>}
   */
  async flush() {
    if (this._bezig) return { verzonden: 0, mislukt: 0, gedropt: 0 };
    this._bezig = true;
    try {
      const jobs = this._lees();
      if (jobs.length === 0) return { verzonden: 0, mislukt: 0, gedropt: 0 };

      const payload = {
        autos: jobs.filter((j) => j.soort === 'auto').map((j) => j.record),
        ritten: jobs.filter((j) => j.soort === 'rit').map((j) => j.record),
        tankbeurten: jobs.filter((j) => j.soort === 'tankbeurt').map((j) => j.record),
      };

      try {
        const res = await this._api.push(payload);
        // Alle records die geen conflict opleverden zijn toegepast op de server.
        // De conflicts die terugkomen blijven we NIET vanzelf op de queue
        // gooien; consumers krijgen ze via een event in een latere sprint.
        if (res?.serverTime) this.setCursor(res.serverTime);
        this._schrijf([]);
        return { verzonden: jobs.length, mislukt: 0, gedropt: 0 };
      } catch (e) {
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
          // Permanent foute payload (bv. 403, 422) — niet eindeloos retryen.
          this._schrijf([]);
          return { verzonden: 0, mislukt: 0, gedropt: jobs.length };
        }
        // Netwerkfout of 5xx — bump pogingen en houd op de queue.
        const opnieuw = jobs
          .map((j) => ({ ...j, pogingen: j.pogingen + 1 }))
          .filter((j) => j.pogingen <= MAX_ATTEMPTS);
        const verloren = jobs.length - opnieuw.length;
        this._schrijf(opnieuw);
        return { verzonden: 0, mislukt: opnieuw.length, gedropt: verloren };
      }
    } finally {
      this._bezig = false;
    }
  }
}
