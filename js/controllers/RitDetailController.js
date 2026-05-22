// ── RitDetailController ───────────────────────────────────────────────────────
// Strava-achtige detailweergave van één rit: een kaart met de gereden route
// plus statistieken. Geopend vanuit de ritten-lijst (mobiel) en de
// "Recente ritten"-widget (desktop) via open(ritId).
//
// De Leaflet-kaart krijgt een eigen instance (los van MapController) en wordt
// éénmalig aangemaakt zodra de overlay zichtbaar is — daarna hergebruikt.
import { Utils } from '../core/Utils.js';
import { InfoOverlay } from '../ui/InfoOverlay.js';

export class RitDetailController {
  constructor(db) {
    this._db = db;
    this._map = null;
    this._tileLayer = null;
    this._lagen = [];
    this._gebonden = false;
    this._historyActief = false;
    this._veegTimers = [];
    this._veegActief = false;

    window.addEventListener('thema:gewijzigd', () => {
      if (!this._tileLayer || !this._map) return;
      const cfg = this._tileConfig();
      this._tileLayer.setUrl(cfg.url);
      if (this._tileLayer.options) this._tileLayer.options.attribution = cfg.attribution;
      this._map.attributionControl?._update?.();
    });
  }

  // ── Openen / sluiten ───────────────────────────────────────────────────────

  /** Open de detailweergave voor de rit met dit id. */
  open(ritId) {
    const overlay = document.getElementById('rit-detail-overlay');
    if (!overlay) return;

    const d = this._db.load();
    const rit = (d.ritten || []).find((r) => r.id === ritId);
    if (!rit) return;

    this._bindEvents();

    // Reset eventuele inline-transform van een vorige swipe-dismiss.
    const card = overlay.querySelector('.rd-card');
    if (card) { card.style.transition = ''; card.style.transform = ''; }

    // Browser-/Android-terugknop sluit de overlay i.p.v. de app te verlaten.
    if (!this._historyActief) {
      history.pushState({ ritDetail: true }, '');
      this._historyActief = true;
    }

    // Eerst zichtbaar maken (opacity 0) zodat de kaart-container een echte
    // grootte krijgt — Leaflet kan geen map in een display:none element bouwen.
    overlay.classList.remove('hidden');
    this._vulPaneel(rit, d);
    this._toonKaart(rit);

    const paneel = overlay.querySelector('.rd-paneel');
    if (paneel) paneel.scrollTop = 0;

    this._misschienVeegHint();

    requestAnimationFrame(() => requestAnimationFrame(() => {
      overlay.classList.add('zichtbaar');
    }));
  }

  /**
   * Sluit via history.back() zodat de gepushte history-state wordt opgeruimd;
   * de popstate-handler voert daarna de daadwerkelijke sluit-animatie uit.
   */
  close() {
    if (this._historyActief) {
      history.back();
    } else {
      this._doeDicht();
    }
  }

  /** Voer de sluit-animatie uit en ruim inline-styles op. */
  _doeDicht() {
    this._historyActief = false;
    this._stopVeegHint();
    const overlay = document.getElementById('rit-detail-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    overlay.classList.remove('zichtbaar');
    setTimeout(() => {
      overlay.classList.add('hidden');
      const card = overlay.querySelector('.rd-card');
      if (card) { card.style.transition = ''; card.style.transform = ''; }
    }, 320);
  }

  _bindEvents() {
    if (this._gebonden) return;
    this._gebonden = true;
    document.getElementById('rd-sluit')?.addEventListener('click', () => this.close());
    document.getElementById('rd-backdrop')?.addEventListener('click', () => this.close());
    document.getElementById('rd-route-hint')?.addEventListener('click', () => {
      InfoOverlay.toon('route');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      // Niet sluiten als er een info-overlay bovenop ligt — die handelt 'm zelf.
      const info = document.getElementById('info-overlay');
      if (info && !info.classList.contains('hidden')) return;
      const overlay = document.getElementById('rit-detail-overlay');
      if (overlay && !overlay.classList.contains('hidden')) this.close();
    });
    // Hardware-/browser-terugknop → overlay sluiten i.p.v. app verlaten.
    window.addEventListener('popstate', () => {
      if (this._historyActief) this._doeDicht();
    });
    this._bindSwipeOmlaag();
  }

  /**
   * Swipe omlaag op het paneel sluit de detailweergave (mobiel). Armt alleen
   * als het paneel bovenaan staat (scrollTop 0) zodat scrollen niet hindert;
   * het hele kaartje (.rd-card) schuift mee.
   */
  _bindSwipeOmlaag() {
    const overlay = document.getElementById('rit-detail-overlay');
    const paneel = overlay?.querySelector('.rd-paneel');
    const card = overlay?.querySelector('.rd-card');
    if (!paneel || !card) return;

    const DREMPEL = 90;
    let startY = 0;
    let bezig = false;
    let dy = 0;

    paneel.addEventListener('touchstart', (e) => {
      if (paneel.scrollTop > 0 || e.touches.length !== 1) { bezig = false; return; }
      startY = e.touches[0].clientY;
      bezig = true;
      dy = 0;
      if (this._veegActief) this._stopVeegHint();
    }, { passive: true });

    paneel.addEventListener('touchmove', (e) => {
      if (!bezig) return;
      dy = e.touches[0].clientY - startY;
      if (dy <= 0) { card.style.transform = ''; dy = 0; return; }
      card.style.transition = 'none';
      card.style.transform = `translateY(${dy}px)`;
      e.preventDefault();
    }, { passive: false });

    paneel.addEventListener('touchend', () => {
      if (!bezig) return;
      bezig = false;
      if (dy >= DREMPEL) {
        card.style.transition = 'transform 0.26s cubic-bezier(0.4, 0, 1, 1)';
        card.style.transform = 'translateY(100%)';
        this._veegHintGeleerd();
        this.close();
      } else {
        card.style.transition = '';
        card.style.transform = '';
      }
    });
  }

  // ── Paneel vullen ──────────────────────────────────────────────────────────

  _vulPaneel(rit, d) {
    const auto = (d.autos || []).find((a) => a.id === rit.auto_id) || null;
    const datumObj = new Date(rit.datum);

    const titel = document.getElementById('rd-titel');
    if (titel) titel.textContent = rit.bestemming ? 'Rit naar ' + rit.bestemming : 'Rit';

    const datum = document.getElementById('rd-datum');
    if (datum) {
      const txt = datumObj.toLocaleDateString('nl-NL', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      datum.textContent = txt.charAt(0).toUpperCase() + txt.slice(1);
    }

    const heroKm = document.getElementById('rd-hero-km');
    if (heroKm) heroKm.textContent = (Number(rit.km) || 0).toFixed(1).replace('.', ',');

    // ── Stat-cellen ──────────────────────────────────────────────────────────
    const kosten = this._ritKosten(rit, auto);
    const tijd = datumObj.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const datumKort = datumObj.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    const heeftTrack = Array.isArray(rit.gps_track) && rit.gps_track.length > 1;

    const cellen = [
      { lbl: 'Kosten', val: kosten != null ? Utils.eur(kosten) : '—' },
      { lbl: 'Datum', val: datumKort },
      { lbl: 'Tijdstip', val: tijd },
    ];
    cellen.push({
      lbl: 'Route',
      val: heeftTrack
        ? rit.gps_track.length + ' meetpunten'
        : (rit.start && rit.eind ? 'Start + eind' : 'Niet vastgelegd'),
    });
    if (Number(rit.km_stand) > 0) {
      cellen.push({ lbl: 'KM-stand', val: Number(rit.km_stand).toLocaleString('nl-NL') + ' km' });
    }

    const stats = document.getElementById('rd-stats');
    if (stats) {
      const oneven = cellen.length % 2 === 1;
      stats.innerHTML = cellen.map((c, i) => {
        const breed = oneven && i === cellen.length - 1 ? ' rd-stat-breed' : '';
        return `<div class="rd-stat${breed}">`
          + `<span class="rd-stat-lbl">${Utils.esc(c.lbl)}</span>`
          + `<span class="rd-stat-val">${Utils.esc(c.val)}</span>`
          + '</div>';
      }).join('');
    }

    const notBlok = document.getElementById('rd-notitie-blok');
    const notTxt = document.getElementById('rd-notitie-txt');
    if (notBlok && notTxt) {
      if (rit.notitie) {
        notTxt.textContent = rit.notitie;
        notBlok.classList.remove('hidden');
      } else {
        notBlok.classList.add('hidden');
      }
    }
  }

  /** Brandstof-/laadkosten van één rit — zelfde formule als Utils.berekenSaldo. */
  _ritKosten(rit, auto) {
    if (!auto) return null;
    const km = Number(rit.km) || 0;
    if (auto.type === 'elektrisch') {
      return (km / 100) * (auto.kwh_per_100km || 15) * (auto.prijs_per_kwh || 0.25);
    }
    return (km / (auto.km_per_liter || 14)) * (auto.prijs_per_liter || 2.10);
  }

  // ── Kaart ──────────────────────────────────────────────────────────────────

  _toonKaart(rit) {
    const overlay = document.getElementById('rit-detail-overlay');

    // Verzamel de te tekenen punten: GPS-track indien aanwezig, anders het
    // start- en eindpunt.
    let punten = [];
    let opgenomen = false;
    const track = Array.isArray(rit.gps_track)
      ? rit.gps_track.filter((p) => Array.isArray(p) && p.length >= 2
          && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
      : [];

    if (track.length > 1) {
      punten = track.map((p) => [Number(p[0]), Number(p[1])]);
      opgenomen = true;
    } else {
      [rit.start, rit.eind].forEach((p) => {
        if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
          punten.push([p.lat, p.lng]);
        }
      });
    }

    // Geen geografische data → kaart verbergen, alleen statistieken tonen.
    if (!punten.length || typeof L === 'undefined') {
      overlay?.classList.add('rd-geen-kaart');
      this._zetRouteHint('geen');
      return;
    }
    overlay?.classList.remove('rd-geen-kaart');

    const map = this._zorgKaart();
    this._wisLagen();

    if (punten.length > 1) {
      const lijn = L.polyline(punten, {
        color: '#5e9464',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        // Globale (niet-opgenomen) routes als stippellijn — eerlijk over de
        // beperkte precisie: het is geen echt gereden pad.
        dashArray: opgenomen ? null : '1 11',
      }).addTo(map);
      this._lagen.push(lijn);
    }

    const start = punten[0];
    const eind = punten[punten.length - 1];
    this._lagen.push(
      L.marker(start, { icon: this._pin('#4e7d52'), interactive: false }).addTo(map)
    );
    if (punten.length > 1) {
      this._lagen.push(
        L.marker(eind, { icon: this._pin('#c94040'), interactive: false }).addTo(map)
      );
    }

    this._zetBadge(opgenomen, punten.length);
    this._zetRouteHint(opgenomen ? 'opgenomen' : 'globaal');

    // invalidateSize + fitBounds in een rAF zodat de container zeker
    // zijn definitieve afmetingen heeft.
    requestAnimationFrame(() => {
      map.invalidateSize();
      if (punten.length > 1) {
        map.fitBounds(L.latLngBounds(punten), { padding: [44, 44], maxZoom: 16 });
      } else {
        map.setView(punten[0], 14);
      }
    });
  }

  /** Maak de Leaflet-kaart aan (éénmalig) en ververs de tile-laag op thema. */
  _zorgKaart() {
    const cfg = this._tileConfig();
    if (this._map) {
      if (this._tileLayer) this._tileLayer.setUrl(cfg.url);
      return this._map;
    }
    this._map = L.map('rd-kaart', {
      zoomControl: false,
      attributionControl: true,
    });
    this._tileLayer = L.tileLayer(cfg.url, {
      subdomains: cfg.subdomains,
      attribution: cfg.attribution,
      maxZoom: 20,
    }).addTo(this._map);
    return this._map;
  }

  _wisLagen() {
    this._lagen.forEach((laag) => {
      try { this._map.removeLayer(laag); } catch { /* laag al weg */ }
    });
    this._lagen = [];
  }

  _zetBadge(opgenomen, aantalPunten) {
    const badge = document.getElementById('rd-kaart-badge');
    const txt = document.getElementById('rd-kaart-badge-txt');
    if (!badge || !txt) return;
    badge.classList.remove('hidden');
    if (opgenomen) {
      badge.classList.remove('globaal');
      txt.textContent = 'GPS-route';
    } else {
      badge.classList.add('globaal');
      txt.textContent = aantalPunten > 1 ? 'Globale route' : 'Startpunt';
    }
  }

  /**
   * Toon/verberg de uitleg-banner onder de hero. Bij een opgenomen GPS-route
   * is uitleg overbodig; bij een rechte lijn of ontbrekende route legt de
   * banner uit waarom — tikken opent de gedeelde info-overlay.
   */
  _zetRouteHint(soort) {
    const hint = document.getElementById('rd-route-hint');
    if (!hint) return;
    if (soort === 'opgenomen') {
      hint.classList.add('hidden');
      return;
    }
    const titel = document.getElementById('rd-hint-titel');
    const sub = document.getElementById('rd-hint-sub');
    if (soort === 'globaal') {
      if (titel) titel.textContent = 'Rechte lijn op de kaart';
      if (sub) sub.textContent = 'Smart-tracking stond uit — alleen start en eind zijn bekend.';
    } else {
      if (titel) titel.textContent = 'Geen route op de kaart';
      if (sub) sub.textContent = 'Deze rit heeft geen GPS-gegevens.';
    }
    hint.classList.remove('hidden');
  }

  // ── Veeg-hint (onboarding) ─────────────────────────────────────────────────

  _veegHintStatus() {
    try { return parseInt(localStorage.getItem('tanklog_rd_veeg_hint') || '0', 10) || 0; }
    catch { return 99; }
  }

  _veegHintGeteld() {
    try {
      const v = this._veegHintStatus();
      if (v < 99) localStorage.setItem('tanklog_rd_veeg_hint', String(v + 1));
    } catch { /* opslag niet beschikbaar */ }
  }

  /** Markeer het veeg-gebaar als geleerd — hint nooit meer tonen. */
  _veegHintGeleerd() {
    try { localStorage.setItem('tanklog_rd_veeg_hint', '99'); } catch { /* idem */ }
    this._stopVeegHint();
  }

  /**
   * Toon de eerste paar keer een hint dat het paneel weg te swipen is — de
   * greep valt anders weg tegen de kaart. Alleen op mobiel mét kaart.
   */
  _misschienVeegHint() {
    this._stopVeegHint();
    const overlay = document.getElementById('rit-detail-overlay');
    if (!overlay) return;
    if (window.matchMedia('(min-width: 1280px)').matches) return;
    if (overlay.classList.contains('rd-geen-kaart')) return;
    if (this._veegHintStatus() >= 3) return;

    this._veegHintGeteld();
    this._veegActief = true;

    const pil = document.getElementById('rd-veeg-hint');
    const card = overlay.querySelector('.rd-card');

    // Pill verschijnt na de entree, blijft ~3s, fade dan weg.
    this._veegTimers.push(setTimeout(() => pil?.classList.remove('hidden', 'uit'), 480));
    this._veegTimers.push(setTimeout(() => pil?.classList.add('uit'), 3600));
    this._veegTimers.push(setTimeout(() => pil?.classList.add('hidden'), 4000));

    // Kaartje "bobt" één keer — doet het veeg-gebaar voor.
    this._veegTimers.push(setTimeout(() => {
      if (!card) return;
      card.classList.add('rd-bob');
      card.addEventListener('animationend',
        () => card.classList.remove('rd-bob'), { once: true });
    }, 620));
  }

  /** Stop de veeg-hint: timers wissen, pill en bob verbergen. */
  _stopVeegHint() {
    this._veegTimers.forEach((t) => clearTimeout(t));
    this._veegTimers = [];
    this._veegActief = false;
    document.getElementById('rd-veeg-hint')?.classList.add('hidden');
    document.querySelector('#rit-detail-overlay .rd-card')?.classList.remove('rd-bob');
  }

  _tileConfig() {
    const thema = document.documentElement.getAttribute('data-thema') || 'klassiek';
    const stadiaKey = this._db?.getStadiaApiKey?.() ?? '';
    return Utils.tileConfig(thema, stadiaKey);
  }

  /** Ronde marker-pin (zelfde stijl als de start/eind-pins op de hoofdkaart). */
  _pin(kleur) {
    return L.divIcon({
      html: `<div style="width:15px;height:15px;background:${kleur};`
        + 'border:3px solid #fff;border-radius:50%;'
        + 'box-shadow:0 2px 8px rgba(0,0,0,0.45)"></div>',
      iconSize: [15, 15],
      iconAnchor: [7.5, 7.5],
      className: '',
    });
  }
}

export default RitDetailController;
