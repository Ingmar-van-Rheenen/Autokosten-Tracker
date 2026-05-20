// ── App ───────────────────────────────────────────────────────────────────────
import { Utils } from './Utils.js';
import { Database } from './Database.js';
import { GeoService } from '../services/GeoService.js';
import { MapController } from '../services/MapController.js';
import { PrijsService } from '../services/PrijsService.js';
import { RitController } from '../controllers/RitController.js';
import { RittenController } from '../controllers/RittenController.js';
import { RitDetailController } from '../controllers/RitDetailController.js';
import { MaandRecapController } from '../controllers/MaandRecapController.js';
import { StorageInfo } from '../ui/StorageInfo.js';
import { NotificatieController } from '../ui/NotificatieController.js';
import { TankController } from '../controllers/TankController.js';
import { StatsController } from '../controllers/StatsController.js';
import { AutoManager } from '../controllers/AutoManager.js';
import { DataManager } from '../controllers/DataManager.js';
import { OnderhoudController } from '../controllers/OnderhoudController.js';
import { PlannerController } from '../controllers/PlannerController.js';
import { DeelController } from '../controllers/DeelController.js';
import { BottomSheetController } from '../controllers/BottomSheetController.js';
import { VasteKostenController } from '../controllers/VasteKostenController.js';
import { BetalingenController } from '../controllers/BetalingenController.js';
import { AfrekenController } from '../controllers/AfrekenController.js';
import { SyncController } from '../controllers/SyncController.js';
import { InfoOverlay } from '../ui/InfoOverlay.js';
import { Changelog } from '../ui/Changelog.js';
import { ThemaController } from '../ui/ThemaController.js';
import { ConfirmModal } from '../ui/ConfirmModal.js';
import { DesktopDashboard } from '../desktop/DesktopDashboard.js';

const SCHERMEN = ['screen-splash', 'screen-intro', 'screen-auto', 'screen-app'];
const TAB_VOLGORDE = ['kaart', 'ritten', 'saldo', 'overzicht', 'instellingen'];

export class App {
  constructor() {
    this._db = new Database();
    this._geo = new GeoService();

    // Thema MOET vóór de eerste render — schrijft data-thema op <html>
    ThemaController.init(this._db);

    this._kaart = new MapController('map', this._db);
    this._stats = new StatsController(this._db);
    this._prijsService = new PrijsService();

    this._vasteKosten = new VasteKostenController(this._db);
    this._betalingen = new BetalingenController(this._db);
    this._afreken = new AfrekenController(this._db);
    this._sync = null; // init() lazy in _toonApp zodra dataManager bestaat

    this._ritController = new RitController(
      this._db, this._geo, this._kaart, () => this._onRitUpdate()
    );
    this._deelController = new DeelController(this._db);
    this._ritDetail = new RitDetailController(this._db);
    this._maandRecap = new MaandRecapController(this._db, { afreken: this._afreken });
    this._notif = new NotificatieController(this._db);
    this._rittenController = new RittenController(
      this._db,
      () => this._onRitUpdate(),
      (id) => this._deelController.openModal(id),
      (id) => this._ritDetail.open(id),
    );
    this._tankController = new TankController(
      this._db, () => this._onTankUpdate()
    );
    this._onderhoudController = new OnderhoudController(this._db);
    this._plannerController = new PlannerController(this._db, this._geo);
    this._autoManager = new AutoManager(this._db, () => this._toonApp());
    this._autoManager.setSchermWisselaar((id) => this._toonScherm(id));
    this._autoManager.setSnelleWisseler(() => this._snelWissel());

    this._dataManager = new DataManager(this._db);

    window.exportData = () => this._dataManager.exporteer();
    window.importData = () => this._dataManager.importeer();
    window.resetData = () => this._dataManager.reset();

    this._huidigTabIndex = 0;
    this._navGebonden = false;
    this._cachedGps = null;
    this._tankstationsActief = false;
  }

  async init() {
    // Vaste minimum splash-duur zodat alle stagger-animaties kunnen afspelen
    // en de gebruiker écht ziet wat er gebeurt — ongeacht hoe snel GPS is.
    const MIN_SPLASH_MS = 2800;
    const splashStart = Date.now();

    document.getElementById('screen-splash').classList.remove('hidden');

    // GPS start alvast in de achtergrond — getGps heeft zelf 12s timeout
    const gpsBelofte = this._geo.getGps().catch(() => null);

    // Install overlay als allereerste stap (blokkeert tot dismiss)
    await this._checkInstallOverlay();

    this._setSplashStatus('LOCATIE OPHALEN');

    // Wacht óf tot GPS terugkomt, óf max 6s
    this._cachedGps = await Promise.race([
      gpsBelofte,
      Utils.wacht(6000).then(() => null),
    ]);

    // Pre-warm map tiles rondom de gevonden locatie zodat de map
    // direct ingezoomd verschijnt (SW cached ze in TILE_CACHE).
    if (this._cachedGps) {
      this._setSplashStatus('KAART VOORBEREIDEN');
      await this._prefetchTilesRond(this._cachedGps);
      this._setSplashStatus('KLAAR');
    } else {
      this._setSplashStatus('GEEN GPS — VERDER ZONDER');
    }

    // Forceer minimum splash-tijd — als alles snel klaar was, wacht extra
    const verstreken = Date.now() - splashStart;
    if (verstreken < MIN_SPLASH_MS) {
      await Utils.wacht(MIN_SPLASH_MS - verstreken);
    }

    this._ritController.setCachedGps(this._cachedGps);

    const d = this._db.load();
    if (!d.autos.length) {
      if (!localStorage.getItem('tanklog_intro_gedaan')) {
        await this._toonScherm('screen-intro');
        this._bindIntro();
      } else {
        this._autoManager.toonAutoSelect();
      }
    } else {
      await this._toonApp();
      this._verwerkUrlActie();
    }
  }

  _bindIntro() {
    const slides = document.querySelectorAll('.intro-slide');
    const dots = document.querySelectorAll('.intro-dot');
    const volgendeBtn = document.getElementById('intro-volgende');
    const skipBtn = document.getElementById('intro-skip');
    let huidig = 0;

    const naarSlide = (nieuw) => {
      slides[huidig].classList.remove('actief');
      slides[huidig].classList.add('verlaat');
      const oud = huidig;
      setTimeout(() => slides[oud].classList.remove('verlaat'), 320);

      huidig = nieuw;
      slides[huidig].classList.add('actief');
      dots.forEach((d, i) => d.classList.toggle('actief', i === huidig));
      volgendeBtn.textContent = huidig === slides.length - 1 ? 'Aan de slag →' : 'Volgende →';
    };

    volgendeBtn.addEventListener('click', () => {
      if (huidig < slides.length - 1) {
        naarSlide(huidig + 1);
      } else {
        this._sluitIntro();
      }
    });

    skipBtn.addEventListener('click', () => this._sluitIntro());
  }

  _sluitIntro() {
    try { localStorage.setItem('tanklog_intro_gedaan', '1'); } catch {}
    this._autoManager.toonAutoSelect();
  }

  _verwerkUrlActie() {
    const params = new URLSearchParams(window.location.search);
    const actie = params.get('action');
    if (!actie) return;

    history.replaceState(null, '', window.location.pathname);

    if (actie === 'start') {
      setTimeout(() => document.getElementById('btn-start')?.click(), 400);
    }

    // Share-target: vanuit Google Maps / browser-share opent Tanklog met
    // ?share_title=… &share_text=… &share_url=…  Wij plukken er een leesbare
    // bestemming uit (titel of tekst) en openen het rit-toevoegen-flow.
    const titel = params.get('share_title');
    const tekst = params.get('share_text');
    const url   = params.get('share_url');
    if (titel || tekst || url) {
      const bestemming = (titel || tekst || url || '').trim().slice(0, 120);
      setTimeout(() => this._openRitMetBestemming(bestemming), 600);
    }

    // Direct naar een specifieke tab (gebruikt door notif-clicks)
    const tab = params.get('tab');
    if (tab && ['kaart', 'ritten', 'saldo', 'overzicht', 'instellingen'].includes(tab)) {
      setTimeout(() => this._navigeerNaarTab(tab), 400);
    }
  }

  /**
   * Open de "nieuwe rit"-flow met een voor-ingevulde bestemming. Gebruikt
   * de DesktopModals op desktop en de mobile rit-flow op kleinere schermen.
   */
  _openRitMetBestemming(bestemming) {
    if (!bestemming) return;
    const desktop = window.matchMedia('(min-width: 1280px)').matches;
    if (desktop && this._desktopDashboard?._modals?.openRit) {
      this._desktopDashboard._modals.openRit();
      // Probeer het bestemmings-veld direct te vullen
      const inp = document.getElementById('desk-rit-bestemming');
      if (inp) { inp.value = bestemming; inp.dispatchEvent(new Event('input')); }
    } else {
      // Mobiel: vul de bestemming in op de rit-pill / confirm-state
      Utils.toast(`Bestemming: ${bestemming}`);
      // (Op mobiel is rit-toevoegen een live GPS-flow; we kunnen geen
      // bestemming voor-invullen zonder een actieve rit. Toast is daarom
      // de eerlijke MVP — desktop krijgt de echte share-target ervaring.)
    }
  }

  // ── Schermnavigatie ───────────────────────────────────────────────────────

  async _toonScherm(id) {
    const huidigId = SCHERMEN.find((s) => {
      const el = document.getElementById(s);
      return el && !el.classList.contains('hidden') && !el.classList.contains('screen-exit');
    });

    if (huidigId === id) return;

    const oudEl = huidigId ? document.getElementById(huidigId) : null;
    const nieuwEl = document.getElementById(id);

    if (huidigId === 'screen-splash') {
      this._splashExit();

      nieuwEl.classList.remove('hidden');
      nieuwEl.classList.add('screen-enter-from-splash');
      nieuwEl.addEventListener('animationend', () => {
        nieuwEl.classList.remove('screen-enter-from-splash');
      }, { once: true });

      setTimeout(() => {
        oudEl?.classList.add('hidden');
      }, 620);

    } else {
      nieuwEl.classList.remove('hidden');
      nieuwEl.classList.add('screen-enter');
      nieuwEl.addEventListener('animationend', () => {
        nieuwEl.classList.remove('screen-enter');
      }, { once: true });

      if (oudEl) {
        oudEl.classList.add('screen-exit');
        setTimeout(() => {
          oudEl.classList.add('hidden');
          oudEl.classList.remove('screen-exit');
        }, 330);
      }
    }
  }

  /** Update de splash-status-tekst met fade-transition. */
  _setSplashStatus(tekst) {
    const el = document.querySelector('.splash-loader-text');
    if (!el) return;
    if (el.textContent === tekst) return;
    el.classList.add('splash-txt-wissel');
    setTimeout(() => {
      el.textContent = tekst;
      el.classList.remove('splash-txt-wissel');
    }, 180);
  }

  /**
   * Pre-warm de map tile cache: vraagt het 3×3 raster tiles rond de GPS-positie
   * op zoom 15 op via fetch(). De service worker cached ze in TILE_CACHE zodat
   * Leaflet ze direct uit cache haalt zodra de map zichtbaar wordt.
   */
  async _prefetchTilesRond(gps) {
    const zoom = 15;
    const n = Math.pow(2, zoom);
    const latRad = gps.lat * Math.PI / 180;
    const xMid = Math.floor((gps.lng + 180) / 360 * n);
    const yMid = Math.floor(
      (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
    );

    const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
    const stadiaKey = this._db.getStadiaApiKey?.() || '';
    const thema = document.documentElement.getAttribute('data-thema') || 'klassiek';
    const useStadia = stadiaKey || isLocalhost;

    const bouwUrl = (x, y) => {
      if (useStadia) {
        const stijl = thema === 'donker' ? 'alidade_smooth_dark' : 'alidade_smooth';
        const key = stadiaKey ? `?api_key=${encodeURIComponent(stadiaKey)}` : '';
        return `https://tiles.stadiamaps.com/tiles/${stijl}/${zoom}/${x}/${y}.png${key}`;
      }
      const stijl = thema === 'donker' ? 'dark_all' : 'light_all';
      const sub = 'abcd'[(x + y) % 4];
      return `https://${sub}.basemaps.cartocdn.com/${stijl}/${zoom}/${x}/${y}.png`;
    };

    const taken = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        taken.push(
          fetch(bouwUrl(xMid + dx, yMid + dy), { mode: 'no-cors' })
            .catch(() => null)
        );
      }
    }
    // Wacht max 1.5s op de tiles — als ze niet binnen die tijd komen geven
    // we het op (Leaflet haalt ze later alsnog op uit het netwerk).
    await Promise.race([
      Promise.all(taken),
      Utils.wacht(1500),
    ]);
  }

  _splashExit() {
    document.querySelector('#splash-car-scene .car-wrapper')?.classList.add('car-vroom');
    setTimeout(() => {
      document.querySelector('.splash-greeting')?.classList.add('splash-item-exit');
      document.querySelector('.splash-title')?.classList.add('splash-item-exit');
      document.querySelector('.splash-sub')?.classList.add('splash-item-exit');
      document.querySelector('.splash-loader')?.classList.add('splash-item-exit');
      document.querySelector('.car-road')?.classList.add('splash-item-exit');
    }, 100);
  }

  // ── Hoofd app ─────────────────────────────────────────────────────────────

  async _toonApp() {
    const auto = this._db.getGeselecteerdeAuto();
    if (auto) {
      const merk = auto.merk ? auto.merk.toUpperCase() : '';
      const el = document.getElementById('bs-auto-naam');
      if (el) el.textContent = auto.naam.toUpperCase() + (merk ? ' · ' + merk : '');
    }

    await this._toonScherm('screen-app');

    this._kaart.init(this._cachedGps);
    this._kaart.setLocateMeHandler(() => this._locateMe());
    this._cachedGps = null;
    this._ritController.herstelState();
    this._rittenController.render();
    this._tankController.render();
    this._tankController.laadStandaard();
    this._onderhoudController.render();
    this._stats.updateSaldo();
    this._stats.updateOverzicht();

    this._bindBottomNav();
    this._bottomSheet = new BottomSheetController(this._db, (tab) => this._navigeerNaarTab(tab));
    this._bottomSheet.updateQuickStats();
    InfoOverlay.init();
    this._bindKmInfoBtn();
    Changelog.init();
    Changelog.check();
    this._bindShortcutUrl();
    this._bindV3Instellingen();
    this._bindDbUpdated();
    this._vasteKosten.render();
    this._betalingen.render();

    // Desktop dashboard (≥1280px) — render altijd, CSS regelt zichtbaarheid
    this._desktopDashboard = new DesktopDashboard(this._db, {
      afreken: this._afreken,
      vasteKosten: this._vasteKosten,
      stats: this._stats,
      autoManager: this._autoManager,
      ritDetail: this._ritDetail,
    });
    this._desktopDashboard.init();

    // Device-sync (Web Share + WebRTC paring via PeerJS)
    this._sync = new SyncController(this._db, this._dataManager);
    this._sync.init();

    // Maand-recap: trigger-knop binden + check op auto-opening na maandwissel.
    this._bindMaandRecap();

    // Systeem-sectie (versie, opslag, cache wissen, update-check)
    this._bindSysteem();

    // Notificatie-sectie + initiële check
    this._bindNotificaties();

    // Vraag persistent storage zodra mogelijk — beschermt localStorage tegen
    // silent eviction onder geheugen-druk. Stille no-op op browsers zonder API.
    StorageInfo.persist().catch(() => { /* no-op */ });
  }

  /** Bind de "Maand-recap"-knop op de overzicht-tab + check op auto-trigger. */
  _bindMaandRecap() {
    if (this._maandRecapGebonden) return;
    this._maandRecapGebonden = true;

    document.getElementById('recap-trigger')?.addEventListener('click', () => {
      this._maandRecap.open();
    });

    // Subtekst dynamisch maken — bv. "Terugblik op april 2026"
    const sub = document.getElementById('recap-trigger-sub');
    if (sub) {
      const nu = new Date();
      const peil = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
      const maand = peil.toLocaleString('nl-NL', { month: 'long' });
      sub.textContent = `Terugblik op ${maand} ${peil.getFullYear()}`;
    }

    // Auto-trigger: éénmalig bij eerste opening van een nieuwe maand.
    this._maandRecap.controleerAutoStart();
  }

  // ── Systeem-sectie ────────────────────────────────────────────────────────

  async _bindSysteem() {
    if (this._systeemGebonden) return;
    this._systeemGebonden = true;

    const versieEl = document.getElementById('syst-versie');
    const storageEl = document.getElementById('syst-storage');
    const persistEl = document.getElementById('syst-persistent');

    const ververs = async () => {
      const versie = await StorageInfo.getVersion();
      if (versieEl) versieEl.textContent = versie || '—';

      const usage = await StorageInfo.usage();
      if (storageEl && usage) {
        const pct = usage.quota > 0 ? Math.round((usage.bytes / usage.quota) * 100) : 0;
        storageEl.textContent = `${StorageInfo.formatBytes(usage.bytes)} (${pct}%)`;
        storageEl.classList.toggle('gevaar', pct >= 85);
      } else if (storageEl) {
        storageEl.textContent = 'Onbekend';
      }

      const isPersist = await StorageInfo.isPersistent();
      if (persistEl) {
        if (isPersist === true) {
          persistEl.textContent = 'Beveiligd ✓';
          persistEl.classList.add('succes');
        } else if (isPersist === false) {
          persistEl.textContent = 'Niet beveiligd';
          persistEl.classList.add('gevaar');
        } else {
          persistEl.textContent = 'Niet ondersteund';
        }
      }
    };
    await ververs();

    document.getElementById('btn-clear-tiles')?.addEventListener('click', async () => {
      const ja = await ConfirmModal.toon({
        titel: 'Kaart-cache wissen?',
        tekst: 'De opgeslagen kaart-tiles worden verwijderd. Je app-data blijft staan; alleen kaarten moeten opnieuw geladen worden.',
        bevestigLabel: 'Wissen',
      });
      if (!ja) return;
      const ok = await StorageInfo.clearTiles();
      Utils.toast(ok ? 'Kaart-cache gewist ✓' : 'Kon cache niet wissen', ok ? 'ok' : 'err');
      ververs();
    });

    document.getElementById('btn-update-check')?.addEventListener('click', async () => {
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (!reg) { Utils.toast('Service worker niet beschikbaar', 'err'); return; }
        await reg.update();
        Utils.toast('Check gedaan — eventuele update verschijnt automatisch ✓');
      } catch {
        Utils.toast('Check mislukt — geen verbinding?', 'err');
      }
    });
  }

  // ── Notificaties-sectie ───────────────────────────────────────────────────

  async _bindNotificaties() {
    if (this._notifGebonden) return;
    this._notifGebonden = true;

    const status = this._notif.status();
    const masterChk = document.getElementById('notif-master');
    const detail = document.getElementById('notif-detail');
    const statusSub = document.getElementById('notif-status-sub');
    const dlChk = document.getElementById('notif-deadline');
    const dlDgn = document.getElementById('notif-deadline-dagen');
    const saChk = document.getElementById('notif-saldo');
    const saInp = document.getElementById('notif-saldo-drempel');

    // Initial render
    const inst = this._db.getNotificatieInstellingen();
    if (masterChk) masterChk.checked = inst.aan;
    if (dlChk) dlChk.checked = inst.deadline_aan;
    if (dlDgn) dlDgn.value = inst.deadline_dagen;
    if (saChk) saChk.checked = inst.saldo_aan;
    if (saInp) saInp.value = inst.saldo_drempel;
    if (detail) detail.classList.toggle('hidden', !inst.aan);

    const renderStatus = () => {
      if (!statusSub) return;
      statusSub.classList.remove('geweigerd', 'toegestaan');
      if (!status.ondersteund) {
        statusSub.textContent = 'Niet ondersteund op dit apparaat';
        masterChk && (masterChk.disabled = true);
      } else if (Notification.permission === 'denied') {
        statusSub.textContent = 'Geweigerd — wijzig via browser-instellingen';
        statusSub.classList.add('geweigerd');
      } else if (Notification.permission === 'granted') {
        statusSub.textContent = 'Lokale meldingen op dit apparaat';
        statusSub.classList.add('toegestaan');
      } else {
        statusSub.textContent = 'Lokale meldingen op dit apparaat';
      }
    };
    renderStatus();

    masterChk?.addEventListener('change', async () => {
      if (masterChk.checked) {
        const perm = await this._notif.vraagToestemming();
        if (perm !== 'granted') {
          masterChk.checked = false;
          renderStatus();
          Utils.toast('Notificaties geweigerd', 'err');
          return;
        }
        this._db.setNotificatieInstellingen({ aan: true });
        detail?.classList.remove('hidden');
        renderStatus();
        // Direct een check zodat eventuele deadlines/saldo meteen pingen.
        this._notif.checkAlles();
      } else {
        this._db.setNotificatieInstellingen({ aan: false });
        detail?.classList.add('hidden');
      }
    });

    dlChk?.addEventListener('change', () => {
      this._db.setNotificatieInstellingen({ deadline_aan: dlChk.checked });
    });
    dlDgn?.addEventListener('change', () => {
      const n = parseInt(dlDgn.value, 10);
      if (Number.isFinite(n) && n >= 1) this._db.setNotificatieInstellingen({ deadline_dagen: n });
    });
    saChk?.addEventListener('change', () => {
      this._db.setNotificatieInstellingen({ saldo_aan: saChk.checked });
      // Markers wissen zodat een bestaande "in de min"-situatie opnieuw kan pingen.
      if (saChk.checked) this._notif.resetMarkers();
    });
    saInp?.addEventListener('change', () => {
      const n = parseFloat(saInp.value);
      if (Number.isFinite(n) && n > 0) this._db.setNotificatieInstellingen({ saldo_drempel: n });
    });

    // Initiële check + bij elke db-mutatie (debounced) opnieuw — zo krijgt de
    // gebruiker tijdig saldo-meldingen na nieuwe ritten of tankbeurten.
    this._notif.checkAlles();
    if (!this._notifDbHook) {
      this._notifDbHook = true;
      let timer = null;
      window.addEventListener('db:updated', () => {
        clearTimeout(timer);
        timer = setTimeout(() => this._notif.checkAlles(), 500);
      });
    }
  }

  // ── v3 wire-ups voor Instellingen-tab + globale db:updated listener ───────

  _bindV3Instellingen() {
    if (this._v3Gebonden) return;
    this._v3Gebonden = true;

    // Thema-radio's
    const huidigThema = (() => {
      const t = this._db.getThema();
      return t === 'auto' ? 'klassiek' : t;
    })();
    document.querySelectorAll('input[name="thema"]').forEach((radio) => {
      radio.checked = (radio.value === huidigThema);
      radio.addEventListener('change', () => {
        if (radio.checked) ThemaController.set(radio.value);
      });
    });

    // Tikkie/bunq/revolut inputs worden bediend door
    // StatsController._renderBetaalverzoekInstelling (auto-save bij blur
    // + expliciete Opslaan-knop). Hier geen aparte binding meer.

    // Stadia Maps API key
    const stadiaInp = document.getElementById('stadia-key-inp');
    const stadiaBtn = document.getElementById('btn-stadia-save');
    if (stadiaInp) stadiaInp.value = this._db.getStadiaApiKey() || '';
    if (stadiaBtn && stadiaInp) {
      stadiaBtn.addEventListener('click', () => {
        this._db.setStadiaApiKey(stadiaInp.value);
        if (this._kaart && typeof this._kaart.refreshTiles === 'function') {
          this._kaart.refreshTiles();
        }
        Utils.toast('Kaart-instellingen opgeslagen ✓');
      });
    }
    document.getElementById('btn-stadia-info')?.addEventListener('click', () => {
      InfoOverlay.toon('kaart');
    });

    // Afrekenen knop op de saldo-hero (Tank-tab)
    document.getElementById('afreken-knop')?.addEventListener('click', () => {
      this._afreken.openSheet();
    });

    // Reset-auto knop
    document.getElementById('reset-auto-knop')?.addEventListener('click', async () => {
      const auto = this._db.getGeselecteerdeAuto();
      if (!auto) return;
      const ja = await ConfirmModal.toon({
        titel: 'Reset deze auto?',
        tekst: `Alle ritten, tankbeurten, onderhoud, vaste kosten en betalingen voor "${auto.naam}" worden verwijderd. De auto zelf blijft bestaan.`,
        bevestigLabel: 'Verwijder',
        gevaarlijk: true,
      });
      if (!ja) return;
      this._db.resetAuto(auto.id);
      this._refreshAlles();
      Utils.toast('Auto gereset ✓');
    });
  }

  _bindDbUpdated() {
    if (this._dbUpdatedGebonden) return;
    this._dbUpdatedGebonden = true;
    let timer = null;
    window.addEventListener('db:updated', () => {
      clearTimeout(timer);
      timer = setTimeout(() => this._refreshAlles(), 100);
    });
  }

  _refreshAlles() {
    this._rittenController.render();
    this._tankController.render();
    this._tankController.laadStandaard();
    this._onderhoudController.render();
    this._vasteKosten.render();
    this._betalingen.render();
    this._stats.updateSaldo();
    this._stats.updateOverzicht();
    this._stats.updateInstellingen?.();
    this._bottomSheet?.updateQuickStats();
  }

  // ── iOS snelkoppeling ─────────────────────────────────────────────────────

  _bindShortcutUrl() {
    if (this._shortcutUrlGebonden) return;
    this._shortcutUrlGebonden = true;

    const urlEl = document.getElementById('shortcut-url');
    const kopieerBtn = document.getElementById('btn-shortcut-kopieer');
    if (!urlEl || !kopieerBtn) return;

    const url = window.location.origin + window.location.pathname + '?action=start';
    urlEl.textContent = url;

    kopieerBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(url).then(() => {
        Utils.toast('URL gekopieerd ✓');
      }).catch(() => {
        Utils.toast('Kopiëren mislukt', 'err');
      });
    });
  }

  // ── Bottom nav ────────────────────────────────────────────────────────────

  _bindBottomNav() {
    if (this._navGebonden) return;
    this._navGebonden = true;

    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._navigeerNaarTab(btn.dataset.tab);
      });
    });

    // Tankstations toggle knop
    const btnTankstations = document.getElementById('btn-tankstations');
    if (btnTankstations) {
      btnTankstations.addEventListener('click', () => this._toggleTankstations());
    }
  }

  async _locateMe() {
    try {
      const gps = await this._geo.getGps();
      this._kaart.setLocatie(gps);
      this._kaart.setView(gps.lat, gps.lng, 16);
    } catch {
      Utils.toast('Locatie niet beschikbaar', 'err');
    }
  }

  async _toggleTankstations() {
    const btn = document.getElementById('btn-tankstations');
    if (!btn) return;

    if (this._tankstationsActief) {
      // Verberg tankstations
      this._kaart.verbergTankstations();
      this._tankstationsActief = false;
      btn.classList.remove('actief');
      return;
    }

    // Toon tankstations
    btn.disabled = true;
    btn.classList.add('laden');
    btn.querySelector('.ts-icon')?.classList.add('hidden');
    btn.querySelector('.ts-spinner')?.classList.remove('hidden');

    try {
      let gps = this._cachedGps;
      if (!gps) {
        gps = await this._geo.getGps().catch(() => null);
      }
      if (!gps) {
        Utils.toast('Locatie niet beschikbaar', 'err');
        return;
      }

      const auto = this._db.getGeselecteerdeAuto();
      const brandstofType = auto?.brandstof || 'E10';
      const stations = await this._prijsService.getTankstations(gps.lat, gps.lng);
      this._kaart.setLocatie(gps);
      this._kaart.toonTankstations(stations, brandstofType);
      this._tankstationsActief = true;
      btn.classList.add('actief');
      Utils.toast('Tankstations geladen ✓');
    } catch {
      Utils.toast('Tankstations laden mislukt', 'err');
    } finally {
      btn.disabled = false;
      btn.classList.remove('laden');
      btn.querySelector('.ts-icon')?.classList.remove('hidden');
      btn.querySelector('.ts-spinner')?.classList.add('hidden');
    }
  }

  /** Navigeer naar een tab – gedeeld door bottom-nav knoppen en shortcut-buttons */
  _navigeerNaarTab(tab) {
    const nieuweIndex = TAB_VOLGORDE.indexOf(tab);
    if (nieuweIndex < 0 || nieuweIndex === this._huidigTabIndex) return;

    // Klap bottom sheet in bij tab-wissel
    this._bottomSheet?.collapse();

    const animKlasse = nieuweIndex > this._huidigTabIndex
      ? 'tab-from-right'
      : 'tab-from-left';

    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    const actiefBtn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
    actiefBtn?.classList.add('active');

    const svg = actiefBtn?.querySelector('svg');
    if (svg) {
      svg.classList.remove('nav-icoon-stuit');
      void svg.offsetWidth;
      svg.classList.add('nav-icoon-stuit');
      svg.addEventListener('animationend', () => svg.classList.remove('nav-icoon-stuit'), { once: true });
    }

    document.querySelectorAll('.app-tab').forEach((t) => {
      t.classList.remove('active', 'tab-from-right', 'tab-from-left');
      t.classList.add('hidden');
    });

    const tabEl = document.getElementById('tab-' + tab);
    tabEl.classList.remove('hidden');
    tabEl.classList.add('active', animKlasse);
    tabEl.addEventListener('animationend', () => {
      tabEl.classList.remove('tab-from-right', 'tab-from-left');
    }, { once: true });

    this._huidigTabIndex = nieuweIndex;

    if (tab === 'kaart') this._kaart.invalidateSize();
    if (tab === 'saldo') { this._stats.updateSaldo(); this._tankController.render(); this._tankController.laadStandaard(); }
    if (tab === 'overzicht') { this._stats.updateOverzicht(); this._onderhoudController.render(); this._vasteKosten.render(); }
    if (tab === 'instellingen') { this._stats.updateInstellingen(); this._betalingen.render(); }
    if (tab === 'ritten') this._rittenController.render();
  }

  // ── PWA install overlay (gate) ────────────────────────────────────────────

  _checkInstallOverlay() {
    const DISMISS_KEY = 'pwa_banner_dismissed';
    const DISMISS_DUUR = 7 * 24 * 60 * 60 * 1000;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      navigator.standalone === true;
    if (isStandalone) return Promise.resolve();

    let dismissedOp;
    try { dismissedOp = localStorage.getItem(DISMISS_KEY); } catch {}
    if (dismissedOp && Date.now() - parseInt(dismissedOp, 10) < DISMISS_DUUR) return Promise.resolve();

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
    const isMobiel = /android|iphone|ipad|ipod|mobile/i.test(ua) || window.innerWidth < 768;
    if (!isMobiel) return Promise.resolve();

    const overlay = document.getElementById('install-overlay');
    if (!overlay) return Promise.resolve();

    return new Promise((resolve) => {
      const sluit = () => {
        overlay.classList.add('hidden');
        resolve();                                                         // altijd eerst resolve
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
      };

      document.getElementById('install-sluit')?.addEventListener('click', sluit, { once: true });
      document.getElementById('install-later')?.addEventListener('click', sluit, { once: true });
      document.getElementById('install-overlay-bd')?.addEventListener('click', sluit, { once: true });
      window.addEventListener('appinstalled', sluit, { once: true });

      // Android: capture native install-prompt zodra browser hem aanbiedt.
      let deferredPrompt = null;
      if (!isIos) {
        window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault();
          deferredPrompt = e;
        }, { once: true });
      }

      document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
        // Android met native prompt beschikbaar → direct prompten.
        if (deferredPrompt) {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
          sluit();
          return;
        }
        // iOS, of Android zonder native prompt → toon stappen-modal.
        this._toonInstallStappen(isIos ? 'ios' : 'android');
        sluit();
      }, { once: true });

      overlay.classList.remove('hidden');
    });
  }

  /** Toon de install-stappen overlay (zelfde stijl als InfoOverlay). */
  _toonInstallStappen(actiefPlatform = 'ios') {
    const overlay = document.getElementById('install-stappen-overlay');
    if (!overlay) return;

    const wisselPlatform = (platform) => {
      overlay.querySelectorAll('.install-platform-tab').forEach((tab) => {
        const aan = tab.dataset.platform === platform;
        tab.classList.toggle('actief', aan);
        tab.setAttribute('aria-selected', aan ? 'true' : 'false');
      });
      overlay.querySelectorAll('.install-stappen-paneel').forEach((p) => {
        p.classList.toggle('hidden', p.dataset.paneel !== platform);
      });
    };
    wisselPlatform(actiefPlatform);

    overlay.querySelectorAll('.install-platform-tab').forEach((tab) => {
      tab.addEventListener('click', () => wisselPlatform(tab.dataset.platform));
    });

    const sluit = () => {
      overlay.classList.remove('zichtbaar');
      setTimeout(() => overlay.classList.add('hidden'), 320);
    };
    document.getElementById('install-stappen-sluit')?.addEventListener('click', sluit, { once: true });
    document.getElementById('install-stappen-backdrop')?.addEventListener('click', sluit, { once: true });

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('zichtbaar'));
    });
  }

  // ── Snelle auto-wissel ────────────────────────────────────────────────────

  _snelWissel() {
    const auto = this._db.getGeselecteerdeAuto();
    if (auto) {
      const merk = auto.merk ? auto.merk.toUpperCase() : '';
      const el = document.getElementById('bs-auto-naam');
      if (el) el.textContent = auto.naam.toUpperCase() + (merk ? ' · ' + merk : '');
    }
    this._rittenController.render();
    this._tankController.render();
    this._tankController.laadStandaard();
    this._onderhoudController.render();
    this._stats.updateSaldo();
    this._stats.updateOverzicht();
    this._bottomSheet?.updateQuickStats();
    Utils.toast('Auto gewisseld ✓');
  }

  _bindKmInfoBtn() {
    document.getElementById('btn-km-info')?.addEventListener('click', () => {
      InfoOverlay.toon('km');
    });
  }

  // ── Update callbacks ──────────────────────────────────────────────────────

  _onRitUpdate() {
    this._rittenController.render();
    this._stats.updateSaldo();
    this._stats.updateOverzicht();
    this._bottomSheet?.updateQuickStats();
  }

  _onTankUpdate() {
    this._stats.updateSaldo();
    this._stats.updateOverzicht();
    this._bottomSheet?.updateQuickStats();
  }
}
