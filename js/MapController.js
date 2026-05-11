// ── MapController ─────────────────────────────────────────────────────────────
// Beheert de Leaflet-kaart, markers en routelijn.
// Leaflet wordt als globale (`L`) geladen via een <script>-tag in index.html.
import { Utils } from './Utils.js';

export class MapController {
  /**
   * @param {string} containerId - ID van het kaart-element in de DOM
   */
  constructor(containerId) {
    this._containerId = containerId;
    this._map = null;
    this._startMarker = null;
    this._eindMarker = null;
    this._routeLijn = null;
    this._locatieMarker = null;
    this._tankstationMarkers = [];
    this._userPos = null;
  }

  // ── Initialisatie ────────────────────────────────────────────────────────

  /**
   * Initialiseer de Leaflet-kaart (éénmalig).
   * @param {{lat:number,lng:number}|null} cachedGps - Startpositie (optioneel)
   */
  init(cachedGps = null) {
    if (this._map) {
      setTimeout(() => this._map.invalidateSize(), 80);
      return;
    }

    this._map = L.map(this._containerId, { zoomControl: false }).setView(
      [52.3, 5.2],
      8
    );

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://carto.com">CARTO</a> © OpenStreetMap',
    }).addTo(this._map);

    if (cachedGps) {
      this._map.setView([cachedGps.lat, cachedGps.lng], 15);
      this._toonLocatieMarker(cachedGps);
    }

    setTimeout(() => this._map.invalidateSize(), 120);
  }

  // ── Kaart beheer ─────────────────────────────────────────────────────────

  /** Verwijder rit-markers en routelijn (locatiemarker blijft staan) */
  reset() {
    if (!this._map) return;
    [this._startMarker, this._eindMarker, this._routeLijn].forEach((l) => {
      if (l) this._map.removeLayer(l);
    });
    this._startMarker = this._eindMarker = this._routeLijn = null;
  }

  /**
   * Zet de kaartweergave naar een specifieke locatie
   * @param {number} lat
   * @param {number} lng
   * @param {number} zoom
   */
  setView(lat, lng, zoom = 14) {
    this._map?.setView([lat, lng], zoom);
  }

  /** Herbereken de kaartgrootte (na tabwissel of resize) */
  invalidateSize() {
    setTimeout(() => this._map?.invalidateSize(), 60);
  }

  /** Sla de huidige GPS-positie op voor afstandsberekening in popups */
  setLocatie(pos) {
    this._userPos = pos;
  }

  // ── Markers ──────────────────────────────────────────────────────────────

  /**
   * Voeg een startmarker toe (groen)
   * @param {{lat:number,lng:number}} pos
   */
  zetStartMarker(pos) {
    // Verberg locatiemarker tijdens rit
    if (this._locatieMarker) this._locatieMarker.setOpacity(0);

    this._startMarker = L.marker([pos.lat, pos.lng], {
      icon: this._pinIcon('#4e7d52'),
    }).addTo(this._map);
  }

  /**
   * Voeg een eindmarker toe en teken de route
   * @param {{lat:number,lng:number}} pos
   * @param {[number,number][]} coords - Array van [lat,lng] paren
   */
  toonRoute(pos, coords) {
    this._eindMarker = L.marker([pos.lat, pos.lng], {
      icon: this._pinIcon('#c94040'),
    }).addTo(this._map);

    this._routeLijn = L.polyline(coords, {
      color: '#5e9464',
      weight: 4,
      opacity: 0.85,
    }).addTo(this._map);

    this._map.fitBounds(this._routeLijn.getBounds(), { padding: [28, 28] });
  }

  // ── Tankstations ─────────────────────────────────────────────────────────

  /** Toon tankstation-markers op de kaart */
  toonTankstations(stations, autoType = 'E10') {
    this.verbergTankstations();

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const BRANDSTOFTYPES = ['E10', 'E5', 'Diesel', 'LPG', 'CNG'];

    stations.forEach((s) => {
      const heeftType = s.heeft?.[autoType] === true;

      const marker = L.marker([s.lat, s.lng], {
        icon: this._tankstationIcon(heeftType),
        zIndexOffset: heeftType ? 300 : 200,
      });

      // Afstand
      let afstandStr = '';
      if (this._userPos) {
        const km = Utils.haversine(this._userPos, { lat: s.lat, lng: s.lng });
        afstandStr = km < 1
          ? Math.round(km * 1000) + ' m'
          : km.toFixed(1).replace('.', ',') + ' km';
      }

      // Navigatie deep-link
      const mapsUrl = isIos
        ? `maps://maps.apple.com/?daddr=${s.lat},${s.lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;

      // Brandstof badges
      const badgesHtml = BRANDSTOFTYPES
        .filter((t) => s.heeft?.[t])
        .map((t) => `<span class="ts-badge${t === autoType ? ' actief' : ''}">${t}</span>`)
        .join('');

      const brandHtml = s.brand && s.brand !== s.naam
        ? `<div class="ts-popup-brand">${Utils.esc(s.brand)}</div>`
        : '';

      const popup = `
        <div class="ts-popup-inner">
          <div class="ts-popup-naam">${Utils.esc(s.naam)}</div>
          ${brandHtml}
          <div class="ts-popup-meta">
            <div class="ts-popup-badges">${badgesHtml || '<span class="ts-badge-leeg">Onbekend</span>'}</div>
            ${afstandStr ? `<div class="ts-popup-afstand">${afstandStr}</div>` : ''}
          </div>
          <a href="${mapsUrl}" target="_blank" rel="noopener" class="ts-popup-nav-btn">
            <svg viewBox="0 0 14 14" width="13" height="13" fill="currentColor">
              <path d="M7 0L0 14l7-3.5L14 14z"/>
            </svg>
            NAVIGEER
          </a>
        </div>
      `;

      marker.bindPopup(popup, { closeButton: false, className: 'ts-popup', maxWidth: 240 });
      marker.addTo(this._map);
      this._tankstationMarkers.push(marker);
    });
  }

  verbergTankstations() {
    this._tankstationMarkers.forEach((m) => this._map.removeLayer(m));
    this._tankstationMarkers = [];
  }

  // ── Privé helpers ─────────────────────────────────────────────────────────

  /**
   * Toon pulserende "je bent hier"-marker
   * @param {{lat:number,lng:number}} pos
   */
  _toonLocatieMarker(pos) {
    if (this._locatieMarker) {
      this._map.removeLayer(this._locatieMarker);
    }

    this._locatieMarker = L.marker([pos.lat, pos.lng], {
      icon: this._locatieIcon(),
      zIndexOffset: 500,
    }).addTo(this._map);
  }

  /** Pulserende blauwe locatie-dot (zoals native kaart-apps) */
  _locatieIcon() {
    return L.divIcon({
      html: `
        <div class="locatie-marker">
          <div class="locatie-ring"></div>
          <div class="locatie-dot"></div>
        </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      className: '',
    });
  }

  _pinIcon(kleur) {
    return L.divIcon({
      html: `<div style="width:14px;height:14px;background:${kleur};border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      className: '',
    });
  }

  _tankstationIcon(heeftType) {
    const kleur = heeftType ? '#f59e0b' : '#546070';
    const glow = heeftType
      ? 'drop-shadow(0 2px 8px rgba(245,158,11,0.55)) drop-shadow(0 1px 3px rgba(0,0,0,0.5))'
      : 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))';

    return L.divIcon({
      html: `
        <div style="filter:${glow};display:flex;align-items:flex-end;justify-content:center;width:30px;height:34px">
          <svg viewBox="0 0 22 26" width="22" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="4" width="13" height="20" rx="2.5" fill="${kleur}"/>
            <rect x="3" y="7" width="9" height="5.5" rx="1.5" fill="rgba(0,0,0,0.28)"/>
            <rect x="3" y="14.5" width="9" height="1.5" rx="0.75" fill="rgba(0,0,0,0.18)"/>
            <rect x="3" y="17" width="5.5" height="1.5" rx="0.75" fill="rgba(0,0,0,0.18)"/>
            <path d="M14 8 Q19.5 8 19.5 13.5 L19.5 19.5" stroke="${kleur}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
            <rect x="17.5" y="18.5" width="5" height="2.5" rx="1.2" fill="${kleur}"/>
          </svg>
        </div>`,
      iconSize: [30, 34],
      iconAnchor: [11, 34],
      className: '',
    });
  }
}
