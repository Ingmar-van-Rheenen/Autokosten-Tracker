// ── MapController ─────────────────────────────────────────────────────────────
// Beheert de Leaflet-kaart, markers en routelijn.
// Leaflet wordt als globale (`L`) geladen via een <script>-tag in index.html.
import { Utils } from '../core/Utils.js';

// Bekende merkkleuren voor tankstation-pins.
// Keys worden case-insensitive vergeleken; gebruik het hoofdmerk als prefix.
const MERK_KLEUREN = {
  shell:   '#DD1D21',
  bp:      '#006F51',
  esso:    '#003C7E',
  total:   '#ED1C24',
  texaco:  '#DA291C',
  tinq:    '#FFB81C',
  tango:   '#FF6900',
  tamoil:  '#00A651',
  ok:      '#ED1C24',
  avia:    '#DA291C',
  gulf:    '#FF6900',
  dcb:     '#002C5F',
  q8:      '#E2231A',
  shell_express: '#DD1D21',
};

const CARTO_TILES = {
  licht:    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  klassiek: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  donker:   'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

const STADIA_STYLES = {
  licht:    'alidade_smooth',
  klassiek: 'alidade_smooth',
  donker:   'alidade_smooth_dark',
};

const STADIA_ATTRIBUTIE =
  '© <a href="https://stadiamaps.com/">Stadia Maps</a> · ' +
  '© <a href="https://openmaptiles.org/">OpenMapTiles</a> · © OpenStreetMap';
const CARTO_ATTRIBUTIE = '© <a href="https://carto.com">CARTO</a> © OpenStreetMap';

export class MapController {
  /**
   * @param {string} containerId - ID van het kaart-element in de DOM
   * @param {import('./Database.js').Database} [db] - Optioneel, voor Stadia API key
   */
  constructor(containerId, db = null) {
    this._containerId = containerId;
    this._db = db;
    this._map = null;
    this._tileLayer = null;
    this._startMarker = null;
    this._eindMarker = null;
    this._routeLijn = null;
    this._locatieMarker = null;
    this._accuracyCircle = null;
    this._tankstationMarkers = [];
    this._userPos = null;
    this._heading = null;
    // Live-polyline state (v3) — wordt gevuld tijdens actieve rit
    this._livePolyline = null;
    this._liveTrack = null;
    // Locate-me callback (gezet door App.js)
    this._onLocateMe = null;

    // Luister naar thema-wijzigingen om tiles te swappen
    window.addEventListener('thema:gewijzigd', () => this._refreshTiles());
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

    const { url, attribution, subdomains } = this._tileConfig();
    this._tileLayer = L.tileLayer(url, {
      attribution,
      subdomains,
      maxZoom: 20,
    }).addTo(this._map);

    if (cachedGps) {
      this._map.setView([cachedGps.lat, cachedGps.lng], 15);
      this._toonLocatieMarker(cachedGps);
    }

    this._wireFloatingControls();

    setTimeout(() => this._map.invalidateSize(), 120);
  }

  // ── Thema-aware tiles ────────────────────────────────────────────────────

  _tileConfig() {
    const thema = document.documentElement.getAttribute('data-thema') || 'klassiek';
    const stadiaKey = this._db && typeof this._db.getStadiaApiKey === 'function'
      ? this._db.getStadiaApiKey()
      : '';
    const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);

    // Stadia: gebruiken als er een key is, of bij localhost (gratis dev)
    if (stadiaKey || isLocalhost) {
      const style = STADIA_STYLES[thema] || STADIA_STYLES.klassiek;
      const keyParam = stadiaKey ? `?api_key=${encodeURIComponent(stadiaKey)}` : '';
      return {
        url: `https://tiles.stadiamaps.com/tiles/${style}/{z}/{x}/{y}{r}.png${keyParam}`,
        attribution: STADIA_ATTRIBUTIE,
        subdomains: '',
      };
    }

    // Fallback: CartoCDN (geen key nodig, werkt overal)
    return {
      url: CARTO_TILES[thema] || CARTO_TILES.klassiek,
      attribution: CARTO_ATTRIBUTIE,
      subdomains: 'abcd',
    };
  }

  /** Publiek: trigger tile-refresh (na key-wijziging of thema-switch). */
  refreshTiles() {
    this._refreshTiles();
  }

  _refreshTiles() {
    if (!this._map || !this._tileLayer) return;
    const { url, attribution } = this._tileConfig();
    this._tileLayer.setUrl(url);
    if (this._tileLayer.options) this._tileLayer.options.attribution = attribution;
    // Force re-render van attribution-control
    const attrCtrl = this._map.attributionControl;
    if (attrCtrl) {
      attrCtrl._update?.();
    }
  }

  // ── Floating controls ────────────────────────────────────────────────────

  /** App.js geeft een handler door zodat de locate-me knop een GPS-fetch kan triggeren. */
  setLocateMeHandler(fn) {
    this._onLocateMe = fn;
  }

  _wireFloatingControls() {
    const btn = document.getElementById('kaart-locate-me');
    if (btn && !btn._bound) {
      btn._bound = true;
      btn.addEventListener('click', () => {
        // Eerste klik = user gesture → vraag iOS device-orientation permissie
        this._activeerOrientatie();
        if (typeof this._onLocateMe === 'function') this._onLocateMe();
        else if (this._userPos) this.setView(this._userPos.lat, this._userPos.lng, 16);
      });
    }
  }

  /**
   * Probeer device-orientation listener te starten. iOS 13+ vereist permissie
   * vanuit een user-gesture; andere platforms gewoon listener registreren.
   */
  async _activeerOrientatie() {
    if (this._orientatieActief) return;

    const start = () => {
      this._orientatieActief = true;
      window.addEventListener('deviceorientation', (e) => {
        // webkitCompassHeading op iOS = absolute compass (0=N, 90=O, ...)
        // alpha op overige browsers = rotatie rond z-as (0=N, met absolute true)
        const h = e.webkitCompassHeading !== undefined
          ? e.webkitCompassHeading
          : (e.absolute && Number.isFinite(e.alpha) ? 360 - e.alpha : null);
        if (h === null) return;
        this._heading = h;
        if (this._locatieMarker) {
          this._locatieMarker.setIcon(this._locatieIcon());
        }
      });
    };

    if (typeof DeviceOrientationEvent !== 'undefined'
        && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === 'granted') start();
      } catch { /* permissie geweigerd of niet beschikbaar */ }
    } else if (typeof DeviceOrientationEvent !== 'undefined') {
      start();
    }
  }

  // ── Kaart beheer ─────────────────────────────────────────────────────────

  /** Verwijder rit-markers en routelijn (locatiemarker blijft staan) */
  reset() {
    if (!this._map) return;
    if (this._liveSegmenten || this._livePolyline) this.stopLivePolyline();
    [this._startMarker, this._eindMarker, this._routeLijn].forEach((l) => {
      if (l) this._map.removeLayer(l);
    });
    this._startMarker = this._eindMarker = this._routeLijn = null;
  }

  setView(lat, lng, zoom = 14) {
    this._map?.setView([lat, lng], zoom, { animate: true });
  }

  invalidateSize() {
    setTimeout(() => this._map?.invalidateSize(), 60);
  }

  /**
   * Sla de huidige GPS-positie op + render locatie-marker met accuracy-cirkel.
   * Accuracy en heading zijn optioneel — als ze ontbreken, wordt de cirkel
   * niet getekend en blijft de marker statisch.
   * @param {{lat:number,lng:number,accuracy?:number,heading?:number|null}} pos
   */
  setLocatie(pos) {
    this._userPos = pos;
    if (Number.isFinite(pos.heading)) this._heading = pos.heading;
    this._toonLocatieMarker(pos);
    this._toonAccuracyCirkel(pos);
  }

  // ── Markers ──────────────────────────────────────────────────────────────

  zetStartMarker(pos) {
    if (this._locatieMarker) this._locatieMarker.setOpacity(0);
    if (this._accuracyCircle) this._accuracyCircle.setStyle({ opacity: 0, fillOpacity: 0 });

    this._startMarker = L.marker([pos.lat, pos.lng], {
      icon: this._pinIcon('#4e7d52'),
    }).addTo(this._map);
  }

  /**
   * Voeg een eindmarker toe en teken de route met draw-in animatie.
   */
  toonRoute(pos, coords) {
    this._eindMarker = L.marker([pos.lat, pos.lng], {
      icon: this._pinIcon('#c94040'),
    }).addTo(this._map);

    this._routeLijn = L.polyline(coords, {
      color: '#5e9464',
      weight: 4,
      opacity: 0.9,
      className: 'route-draw-in',
    }).addTo(this._map);

    // Trigger draw-in: zet dasharray gelijk aan totale lengte, animeer offset → 0
    const pad = this._routeLijn.getElement();
    if (pad && typeof pad.getTotalLength === 'function') {
      const len = pad.getTotalLength();
      pad.style.strokeDasharray = String(len);
      pad.style.strokeDashoffset = String(len);
      // Force reflow zodat de animatie start
      void pad.getBoundingClientRect();
      pad.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)';
      pad.style.strokeDashoffset = '0';
    }

    this._map.fitBounds(this._routeLijn.getBounds(), { padding: [28, 28] });
  }

  // ── Live polyline (v3) — speed-coded segments ────────────────────────────
  // Tijdens een actieve rit wordt elke nieuwe GPS-tick als een eigen segment
  // getekend, gekleurd op basis van snelheid sinds vorige tick.

  startLivePolyline(beginPos) {
    if (!this._map) return;
    if (this._liveSegmenten) this.stopLivePolyline();

    this._liveTrack = [{ lat: beginPos.lat, lng: beginPos.lng, t: Date.now() }];
    this._liveSegmenten = [];
  }

  voegLivePuntToe(pos) {
    if (!this._liveTrack) return;

    const vorige = this._liveTrack[this._liveTrack.length - 1];
    const meters = Utils.haversine({ lat: vorige.lat, lng: vorige.lng }, pos) * 1000;
    if (meters < 5) return;

    const nu = Date.now();
    const seconden = Math.max(1, (nu - vorige.t) / 1000);
    const kmh = (meters / 1000) / (seconden / 3600);
    const kleur = this._snelheidsKleur(kmh);

    const segment = L.polyline([[vorige.lat, vorige.lng], [pos.lat, pos.lng]], {
      color: kleur,
      weight: 4,
      opacity: 0.88,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(this._map);

    this._liveSegmenten.push(segment);
    this._liveTrack.push({ lat: pos.lat, lng: pos.lng, t: nu });
  }

  stopLivePolyline() {
    const track = this._liveTrack
      ? this._liveTrack.map((p) => [p.lat, p.lng])
      : [];
    if (this._liveSegmenten && this._map) {
      this._liveSegmenten.forEach((s) => this._map.removeLayer(s));
    }
    this._liveSegmenten = null;
    this._liveTrack = null;
    // Compat: stuur het oude veld ook op null
    this._livePolyline = null;
    return track;
  }

  /** Bucket snelheid (km/h) naar één van 4 kleuren. */
  _snelheidsKleur(kmh) {
    if (!Number.isFinite(kmh) || kmh < 0) return '#5e9464';
    if (kmh < 30) return '#4e7d52';        // stadsverkeer — donkergroen
    if (kmh < 80) return '#7ab87a';        // regio — lichtgroen
    if (kmh < 120) return '#f59e0b';       // snelweg — oranje
    return '#c94040';                       // hard — rood
  }

  // ── Tankstations ─────────────────────────────────────────────────────────

  toonTankstations(stations, autoType = 'E10') {
    this.verbergTankstations();

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const BRANDSTOFTYPES = ['E10', 'E5', 'Diesel', 'LPG', 'CNG'];

    // Maak clustergroup aan als markercluster-plugin geladen is (anders fallback)
    if (typeof L.markerClusterGroup === 'function' && !this._clusterGroep) {
      this._clusterGroep = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 14,
        maxClusterRadius: 50,
        iconCreateFunction: (cluster) => {
          const n = cluster.getChildCount();
          return L.divIcon({
            html: `<div class="ts-cluster"><span>${n}</span></div>`,
            className: '',
            iconSize: [36, 36],
          });
        },
      });
      this._map.addLayer(this._clusterGroep);
    }

    stations.forEach((s) => {
      const heeftType = s.heeft?.[autoType] === true;
      const merkKleur = this._merkKleur(s.brand || s.naam);

      const marker = L.marker([s.lat, s.lng], {
        icon: this._tankstationIcon(heeftType, merkKleur),
        zIndexOffset: heeftType ? 300 : 200,
      });

      let afstandStr = '';
      if (this._userPos) {
        const km = Utils.haversine(this._userPos, { lat: s.lat, lng: s.lng });
        afstandStr = km < 1
          ? Math.round(km * 1000) + ' m'
          : km.toFixed(1).replace('.', ',') + ' km';
      }

      const mapsUrl = isIos
        ? `maps://maps.apple.com/?daddr=${s.lat},${s.lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;

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
      if (this._clusterGroep) {
        this._clusterGroep.addLayer(marker);
      } else {
        marker.addTo(this._map);
      }
      this._tankstationMarkers.push(marker);
    });
  }

  verbergTankstations() {
    if (this._clusterGroep) {
      this._clusterGroep.clearLayers();
    } else {
      this._tankstationMarkers.forEach((m) => this._map.removeLayer(m));
    }
    this._tankstationMarkers = [];
  }

  /** Match een merknaam tegen MERK_KLEUREN, return een kleur of fallback oranje. */
  _merkKleur(merkOfNaam) {
    if (!merkOfNaam) return '#f59e0b';
    const key = String(merkOfNaam).toLowerCase().replace(/[^a-z]/g, '');
    for (const [merk, kleur] of Object.entries(MERK_KLEUREN)) {
      const sleutel = merk.replace(/_/g, '');
      if (key.includes(sleutel)) return kleur;
    }
    return '#f59e0b';
  }

  // ── Privé helpers ─────────────────────────────────────────────────────────

  _toonLocatieMarker(pos) {
    if (this._locatieMarker) {
      // Smoothing: gewoon verplaatsen — Leaflet update translate3d, CSS-transitie
      // op .leaflet-marker-icon zorgt dat het soepel verschuift i.p.v. springt.
      this._locatieMarker.setLatLng([pos.lat, pos.lng]);
      // Refresh icon zodat heading-pijl actuele rotatie krijgt
      if (Number.isFinite(this._heading)) {
        this._locatieMarker.setIcon(this._locatieIcon());
      }
      return;
    }

    this._locatieMarker = L.marker([pos.lat, pos.lng], {
      icon: this._locatieIcon(),
      zIndexOffset: 500,
      interactive: false,
    }).addTo(this._map);
    // Markeer DOM-element zodat CSS-transitie alleen op dit type marker werkt
    const el = this._locatieMarker.getElement();
    if (el) el.classList.add('locatie-marker-icon');
  }

  _toonAccuracyCirkel(pos) {
    if (!pos.accuracy || pos.accuracy <= 0) {
      if (this._accuracyCircle) {
        this._map.removeLayer(this._accuracyCircle);
        this._accuracyCircle = null;
      }
      return;
    }

    if (this._accuracyCircle) {
      this._accuracyCircle.setLatLng([pos.lat, pos.lng]);
      this._accuracyCircle.setRadius(pos.accuracy);
      this._accuracyCircle.setStyle({ opacity: 0.45, fillOpacity: 0.12 });
    } else {
      this._accuracyCircle = L.circle([pos.lat, pos.lng], {
        radius: pos.accuracy,
        color: '#5e9464',
        weight: 1,
        opacity: 0.45,
        fillColor: '#5e9464',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(this._map);
    }
  }

  /** Pulserende locatie-dot met optionele heading-pijl. */
  _locatieIcon() {
    const heading = Number.isFinite(this._heading) ? this._heading : null;
    // De wrapper is 32×32 (zelfde size als .locatie-marker) en draait rond
    // zijn eigen midden — dat is exact het midden van de dot. De pijl zit
    // bovenin de wrapper, dus bij rotatie loopt 'ie netjes om de gebruiker.
    const pijlHtml = heading !== null
      ? `<div class="locatie-heading-wrap" style="transform:rotate(${heading}deg)">
           <div class="locatie-heading">
             <svg viewBox="0 0 12 14" width="12" height="14"><path d="M6 0 L11 12 L6 9 L1 12 Z" fill="#5e9464"/></svg>
           </div>
         </div>`
      : '';

    return L.divIcon({
      html: `
        <div class="locatie-marker">
          <div class="locatie-ring"></div>
          <div class="locatie-dot"></div>
          ${pijlHtml}
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

  _tankstationIcon(heeftType, merkKleur) {
    const kleur = heeftType ? merkKleur : '#7a8a9a';
    const glow = heeftType
      ? `drop-shadow(0 2px 8px ${this._hexAlpha(merkKleur, 0.55)}) drop-shadow(0 1px 3px rgba(0,0,0,0.5))`
      : 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))';

    return L.divIcon({
      html: `
        <div style="filter:${glow};display:flex;align-items:flex-end;justify-content:center;width:30px;height:34px">
          <svg viewBox="0 0 22 26" width="22" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="4" width="13" height="20" rx="2.5" fill="${kleur}"/>
            <rect x="3" y="7" width="9" height="5.5" rx="1.5" fill="rgba(255,255,255,0.42)"/>
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

  /** Helper: hex → rgba string met alfa. */
  _hexAlpha(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
}
