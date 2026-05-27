// ── StorageInfo ───────────────────────────────────────────────────────────────
// Verzamel-module voor opslag- en versie-informatie:
//   • persist()          → vraagt persistent storage zodat de browser de data
//                          niet stilletjes evict bij geheugen-druk.
//   • usage()            → totaal gebruikt + quota in bytes.
//   • clearTiles()       → wist alleen de tile-cache (kaart-tegels), niet de
//                          app-bestanden of localStorage.
//   • getVersion()       → vraagt de SW naar zijn CACHE-naam (bv. vroom-v1).
//   • formatBytes()      → human-readable bytes.

export const StorageInfo = {
  /**
   * Vraag de browser om de Vroom-data persistent op te slaan. Zonder dit
   * kan de browser onder geheugen-druk localStorage stilletjes wissen.
   * Op browsers zonder deze API: stille no-op.
   * @returns {Promise<boolean | null>} true=granted, false=denied, null=niet ondersteund
   */
  async persist() {
    if (!navigator.storage || typeof navigator.storage.persist !== 'function') return null;
    try {
      const al = await navigator.storage.persisted();
      if (al) return true;
      return !!(await navigator.storage.persist());
    } catch {
      return null;
    }
  },

  /** @returns {Promise<boolean | null>} */
  async isPersistent() {
    if (!navigator.storage || typeof navigator.storage.persisted !== 'function') return null;
    try { return !!(await navigator.storage.persisted()); }
    catch { return null; }
  },

  /** @returns {Promise<{bytes:number, quota:number} | null>} */
  async usage() {
    if (!navigator.storage || typeof navigator.storage.estimate !== 'function') return null;
    try {
      const est = await navigator.storage.estimate();
      return { bytes: est.usage || 0, quota: est.quota || 0 };
    } catch {
      return null;
    }
  },

  /**
   * Wist de tile-cache via een postMessage naar de SW. Geeft true terug
   * zodra de SW bevestigt of false bij time-out (1.5s).
   */
  async clearTiles() {
    return this._roundtrip({ type: 'CLEAR_TILE_CACHE' }, 'TILE_CACHE_CLEARED', 1500)
      .then((res) => res && res.ok !== false);
  },

  /** @returns {Promise<string | null>} bv. 'vroom-v1' */
  async getVersion() {
    const res = await this._roundtrip({ type: 'GET_VERSION' }, 'VERSION', 1000);
    return res ? res.version : null;
  },

  /**
   * Stuur een message naar de actieve SW en wacht op een response via een
   * MessageChannel — netter dan luisteren naar broadcasts.
   */
  async _roundtrip(msg, verwachtType, timeoutMs) {
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!sw) return null;
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), timeoutMs);
      channel.port1.onmessage = (e) => {
        if (e.data && e.data.type === verwachtType) {
          clearTimeout(timer);
          resolve(e.data);
        }
      };
      try { sw.postMessage(msg, [channel.port2]); }
      catch { clearTimeout(timer); resolve(null); }
    });
  },

  formatBytes(b) {
    if (!Number.isFinite(b) || b <= 0) return '0 B';
    const eenheden = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = b;
    while (n >= 1024 && i < eenheden.length - 1) { n /= 1024; i++; }
    const dec = n >= 100 ? 0 : (n >= 10 ? 1 : 2);
    return n.toFixed(dec).replace('.', ',') + ' ' + eenheden[i];
  },
};

export default StorageInfo;
