// ── GeoService ────────────────────────────────────────────────────────────────

export class GeoService {
  /**
   * Vraag huidige GPS-positie op
   * @returns {Promise<{lat: number, lng: number}>}
   */
  getGps() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) {
        rej(new Error('GPS niet beschikbaar op dit apparaat'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => rej(new Error(e.message)),
        { enableHighAccuracy: true, timeout: 12000 }
      );
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
