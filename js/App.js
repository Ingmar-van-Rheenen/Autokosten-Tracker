// ── App ───────────────────────────────────────────────────────────────────────
import { Utils } from './Utils.js';
import { Database } from './Database.js';
import { GeoService } from './GeoService.js';
import { MapController } from './MapController.js';
import { RitController } from './RitController.js';
import { RittenController } from './RittenController.js';
import { TankController } from './TankController.js';
import { StatsController } from './StatsController.js';
import { AutoManager } from './AutoManager.js';
import { DataManager } from './DataManager.js';
import { OnderhoudController } from './OnderhoudController.js';
import { PlannerController } from './PlannerController.js';
import { DeelController } from './DeelController.js';
import { BottomSheetController } from './BottomSheetController.js';
import { PrijsService } from './PrijsService.js';
import { InfoOverlay } from './InfoOverlay.js';
import { Changelog } from './Changelog.js';

const SCHERMEN = ['screen-splash', 'screen-intro', 'screen-auto', 'screen-app'];
const TAB_VOLGORDE = ['kaart', 'ritten', 'saldo', 'overzicht', 'instellingen'];

export class App {
  constructor() {
    this._db = new Database();
    this._geo = new GeoService();

    this._kaart = new MapController('map');
    this._stats = new StatsController(this._db);
    this._prijsService = new PrijsService();

    this._ritController = new RitController(
      this._db, this._geo, this._kaart, () => this._onRitUpdate()
    );
    this._deelController = new DeelController(this._db);
    this._rittenController = new RittenController(
      this._db, () => this._onRitUpdate(), (id) => this._deelController.openModal(id)
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
    document.getElementById('screen-splash').classList.remove('hidden');

    // GPS start alvast in de achtergrond
    const gpsBelofte = this._geo.getGps().catch(() => null);

    // Install overlay als allereerste stap (blokkeert tot dismiss)
    await this._checkInstallOverlay();

    this._animeerSplashTekst();
    await Utils.wacht(1800);
    this._cachedGps = await Promise.race([
      gpsBelofte,
      Utils.wacht(300).then(() => null),
    ]);
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

  _animeerSplashTekst() {
    const teksten = ['LOCATIE OPHALEN', 'GEGEVENS LADEN', 'BIJNA KLAAR'];
    let i = 0;
    const el = document.querySelector('.splash-loader-text');
    if (!el) return;

    const interval = setInterval(() => {
      i++;
      if (i >= teksten.length) { clearInterval(interval); return; }
      el.classList.add('splash-txt-wissel');
      setTimeout(() => {
        el.textContent = teksten[i];
        el.classList.remove('splash-txt-wissel');
      }, 180);
    }, 600);
  }

  _splashExit() {
    document.querySelector('#splash-car-scene .car-wrapper')?.classList.add('car-vroom');
    setTimeout(() => {
      document.querySelector('.splash-title')?.classList.add('splash-item-exit');
      document.querySelector('.splash-sub')?.classList.add('splash-item-exit');
      document.querySelector('.splash-loader')?.classList.add('splash-item-exit');
      document.querySelector('.splash-road')?.classList.add('splash-item-exit');
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
    if (tab === 'overzicht') { this._stats.updateOverzicht(); this._onderhoudController.render(); }
    if (tab === 'instellingen') this._stats.updateInstellingen();
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

      if (isIos) {
        document.getElementById('install-ios-sectie')?.classList.remove('hidden');
      } else {
        document.getElementById('install-android-sectie')?.classList.remove('hidden');
        let deferredPrompt = null;
        window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault();
          deferredPrompt = e;
        }, { once: true });

        document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
          } else {
            Utils.toast('Gebruik het menu van je browser → "Toevoegen aan beginscherm"');
          }
          sluit();
        }, { once: true });
      }

      overlay.classList.remove('hidden');
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
