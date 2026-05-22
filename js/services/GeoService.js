// ── GeoService ────────────────────────────────────────────────────────────────

export class GeoService {
  /**
   * Vraag huidige GPS-positie op
   * @returns {Promise<{lat:number,lng:number,accuracy:number,heading:number|null}>}
   */
  /**
   * @param {AbortSignal} [signal] - Optionele AbortSignal om de GPS-wacht te annuleren.
   *   Bij abort gooit de promise een DOMException met name 'AbortError'.
   *   Opmerking: getCurrentPosition loopt door in de browser tot de timeout;
   *   het resultaat wordt na abort genegeerd.
   */
  getGps(signal) {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) {
        rej(new Error('GPS niet beschikbaar op dit apparaat'));
        return;
      }
      if (signal?.aborted) {
        rej(new DOMException('GPS geannuleerd', 'AbortError'));
        return;
      }
      let klaar = false;
      navigator.geolocation.getCurrentPosition(
        (p) => {
          klaar = true;
          res({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy || 0,
            heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
          });
        },
        (e) => { if (!klaar) rej(new Error(e.message)); },
        { enableHighAccuracy: true, timeout: 12000 }
      );
      signal?.addEventListener('abort', () => {
        if (!klaar) { klaar = true; rej(new DOMException('GPS geannuleerd', 'AbortError')); }
      }, { once: true });
    });
  }

  /**
   * Bereken een rijroute via OSRM
   * @param {{lat:number,lng:number}} start
   * @param {{lat:number,lng:number}} eind
   * @returns {Promise<{km: number, coords: [number,number][]}>}
   */
  async osrmRoute(start, eind) {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${start.lng},${start.lat};${eind.lng},${eind.lat}` +
      `?overview=full&geometries=geojson`;

    const r = await fetch(url);
    if (!r.ok) throw new Error('OSRM verzoek mislukt');

    const data = await r.json();
    if (!data.routes?.length) throw new Error('Geen route gevonden');

    return {
      km: data.routes[0].distance / 1000,
      coords: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    };
  }

  /**
   * Haal een stadsnaam op via reverse geocoding (Nominatim)
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<string|null>}
   */
  async reverseGeocode(lat, lng) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept-Language': 'nl' } }
      );
      const d = await r.json();
      return (
        d.address?.city ||
        d.address?.town ||
        d.address?.village ||
        d.address?.suburb ||
        null
      );
    } catch {
      return null;
    }
  }
}
