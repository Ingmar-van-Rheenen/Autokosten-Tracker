// ── PrijsService ───────────────────────────────────────────────────────────────
// Haalt brandstofprijssuggestie op via CBS Open Data. Fallback: null.

const CBS_BASE = 'https://opendata.cbs.nl/ODataApi/odata/';
// Bekende CBS dataset-ID's voor motorbrandstofprijzen (meest recent eerst)
const CBS_KANDIDAAT_IDS = ['84672NED', '80416ned', '83655NED'];

export class PrijsService {
  constructor() {
    this._cache = null;
    this._cacheTijd = 0;
    this._datasetId = null;
  }

  /**
   * Geeft een gesuggereerde prijs per liter terug, of null als het mislukt.
   * @param {string} brandstofType - 'E10'|'E5'|'diesel'|'lpg'|'cng'
   * @returns {Promise<number|null>}
   */
  async getSuggestie(brandstofType = 'E10') {
    if (this._cache && Date.now() - this._cacheTijd < 3_600_000) {
      return this._prijsUitCache(brandstofType);
    }

    try {
      // Zoek het juiste CBS dataset via de catalogus
      if (!this._datasetId) {
        this._datasetId = await this._vindDataset();
      }
      if (!this._datasetId) return null;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const r = await fetch(
        `${CBS_BASE}${this._datasetId}/TypedDataSet?$format=json&$top=1&$orderby=Perioden+desc`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!r.ok) return null;
      const data = await r.json();
      const rij = data.value?.[0];
      if (!rij) return null;

      this._cache = rij;
      this._cacheTijd = Date.now();
      return this._prijsUitCache(brandstofType);
    } catch {
      return null;
    }
  }

  // Zoek het CBS dataset-ID dat brandstofprijzen bevat; cache 30 dagen in localStorage
  async _vindDataset() {
    const CACHE_KEY = 'tanklog_cbs_dataset';
    const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { id, ts } = JSON.parse(raw);
        if (id && Date.now() - ts < CACHE_TTL) return id;
      }
    } catch { /* corrupte cache — doorgaan */ }

    try {
      // Haal alle CBS catalogus-items op (OData v2 — geen contains() filter)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const r = await fetch(
        'https://opendata.cbs.nl/ODataCatalog/Tables?$format=json&$select=Identifier,ShortTitle&$top=500',
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (!r.ok) return CBS_KANDIDAAT_IDS[0];

      const data = await r.json();
      const items = data.value ?? [];

      // Filter client-side: titel bevat 'brandstof' én 'prijs'
      const gevonden = items.find((t) => {
        const titel = (t.ShortTitle ?? '').toLowerCase();
        return titel.includes('brandstof') && titel.includes('prijs');
      }) ?? items.find((t) =>
        (t.ShortTitle ?? '').toLowerCase().includes('brandstof')
      );

      const id = gevonden?.Identifier ?? CBS_KANDIDAAT_IDS[0];
      localStorage.setItem(CACHE_KEY, JSON.stringify({ id, ts: Date.now() }));
      return id;
    } catch {
      return CBS_KANDIDAAT_IDS[0];
    }
  }

  _prijsUitCache(type) {
    if (!this._cache) return null;

    // Probeer bekende kolomnamen per brandstoftype
    const kandidaten = {
      E10:    ['BenzineEuro95_1', 'Benzine_1', 'BenzineE10_1', 'Euro95_1', 'Euro95E10_1'],
      E5:     ['SuperPlus_2', 'BenzineSuperPlus_2', 'SuperPlus98_2', 'BenzineE5_2', 'Euro98_2'],
      diesel: ['Diesel_3', 'GasolieVoorwegverkeer_3', 'GasolieDiesel_3', 'Diesel_1'],
      lpg:    ['LPG_4', 'AutogasLPG_4', 'LPG_1'],
      cng:    ['CNG_5', 'Aardgas_5', 'CNG_1'],
    };
    const lijst = kandidaten[type] ?? kandidaten.E10;
    for (const kol of lijst) {
      const v = this._cache[kol];
      if (v != null && v > 0) return parseFloat(v.toFixed(3));
    }

    // Fallback: scan alle numerieke velden in realistisch prijsbereik (€0,50–€5,00)
    for (const v of Object.values(this._cache)) {
      if (typeof v === 'number' && v >= 0.5 && v <= 5.0) {
        return parseFloat(v.toFixed(3));
      }
    }
    return null;
  }

  /**
   * Haalt tankstations op via Overpass API (OpenStreetMap).
   * @param {number} lat
   * @param {number} lng
   * @param {number} radius - meters
   * @returns {Promise<Array>}
   */
  async getTankstations(lat, lng, radius = 4000) {
    const query =
      `[out:json][timeout:15];` +
      `(node[amenity=fuel](around:${radius},${lat},${lng});` +
      `way[amenity=fuel](around:${radius},${lat},${lng}););` +
      `out center;`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!r.ok) throw new Error('Overpass mislukt');
    const data = await r.json();

    return (data.elements || [])
      .map((el) => ({
        id:     el.id,
        lat:    el.lat ?? el.center?.lat,
        lng:    el.lon ?? el.center?.lon,
        naam:   el.tags?.name || el.tags?.brand || 'Tankstation',
        brand:  el.tags?.brand || null,
        heeft: {
          E10:    el.tags?.['fuel:octane_95'] === 'yes' || el.tags?.['fuel:e10'] === 'yes',
          E5:     el.tags?.['fuel:octane_98'] === 'yes' || el.tags?.['fuel:e5'] === 'yes',
          diesel: el.tags?.['fuel:diesel'] === 'yes',
          lpg:    el.tags?.['fuel:lpg'] === 'yes',
          cng:    el.tags?.['fuel:cng'] === 'yes',
        },
      }))
      .filter((s) => s.lat && s.lng);
  }
}
