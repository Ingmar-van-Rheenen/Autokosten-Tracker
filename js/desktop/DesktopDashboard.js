// ── DesktopDashboard ─────────────────────────────────────────────────────────
// Orchestrator voor het desktop-dashboard (≥1280px). Houdt zelf geen widget-
// state bij; iedere widget is een aparte class met een render(auto) methode.
// Verantwoordelijkheden:
//   - Widgets instantiëren en hun render() coordineren
//   - Luisteren naar db:updated + thema:gewijzigd om opnieuw te renderen
//   - Expand-in-place gedrag (klik op widget → andere widgets 0.18 opacity)
//   - Quick-actions koppelen aan dedicated desktop-modals (DesktopModals)
//   - Widget-customizer: aan/uit zetten van widgets + 3 preset-layouts
//   - Stagger-entrance animatie + value-flash bij db-mutaties
import { SaldoWidget } from './widgets/SaldoWidget.js';
import { TrendWidget } from './widgets/TrendWidget.js';
import { RittenWidget } from './widgets/RittenWidget.js';
import { TankWidget } from './widgets/TankWidget.js';
import { VasteKostenWidget } from './widgets/VasteKostenWidget.js';
import { StatsWidget } from './widgets/StatsWidget.js';
import { KaartWidget } from './widgets/KaartWidget.js';
import { QuickActionsWidget } from './widgets/QuickActionsWidget.js';
import { ThemaWidget } from './widgets/ThemaWidget.js';
import { DesktopModals } from './DesktopModals.js';

/** Widgets die uitklapbaar zijn (klik op de tegel opent expand-in-place). */
const EXPANDABLE = ['ritten', 'tank', 'vk', 'kaart'];

/** Volgorde + meta van alle widgets — wordt gebruikt door de customizer. */
const WIDGET_META = [
  { key: 'saldo',   label: 'Saldo (hero)'         },
  { key: 'trend',   label: 'Trend grafiek'        },
  { key: 'ritten',  label: 'Recente ritten'       },
  { key: 'tank',    label: 'Recente tankbeurten'  },
  { key: 'vk',      label: 'Vaste kosten'         },
  { key: 'stats',   label: 'Auto-stats'           },
  { key: 'kaart',   label: 'Kaart-thumbnail'      },
  { key: 'actions', label: 'Snelle acties'        },
  { key: 'themas',  label: 'Thema-switcher'       },
];

/** Default-set wanneer er nog geen voorkeur is opgeslagen. */
const DEFAULT_KEUZE = WIDGET_META.map((w) => w.key);

export class DesktopDashboard {
  constructor(db, deps) {
    this._db = db;
    this._deps = deps;
    this._gebonden = false;
    this._geExpanded = null;
    this._eersteRender = true;

    this._modals = new DesktopModals(db);

    this._widgets = {
      saldo: new SaldoWidget(db),
      trend: new TrendWidget(db),
      ritten: new RittenWidget(db),
      tank: new TankWidget(db),
      vk: new VasteKostenWidget(db),
      stats: new StatsWidget(db),
      kaart: new KaartWidget(db),
      actions: new QuickActionsWidget(db),
      themas: new ThemaWidget(db),
    };
  }

  init() {
    if (this._gebonden) return;
    this._gebonden = true;
    this._bindEvents();
    this._pasZichtbaarheidToe();
    this.render();
    window.addEventListener('db:updated', (e) => {
      // Herrender alleen bij relevante mutaties. setDesktopWidgets herschikt
      // het grid — speciaal behandelen om stagger opnieuw te laten lopen.
      const m = e?.detail?.mutator;
      if (m === 'setDesktopWidgets') {
        this._eersteRender = true;
        this._pasZichtbaarheidToe();
      }
      this.render();
    });
    window.addEventListener('thema:gewijzigd', () => this._widgets.themas.render());
  }

  /** Vol-render: header + alle widgets. */
  render() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) {
      this._toonGeenAuto();
      return;
    }
    this._renderHeader(auto);
    Object.values(this._widgets).forEach((w) => w.render(auto));
    if (this._eersteRender) {
      this._staggerEntrance();
      this._eersteRender = false;
    }
  }

  // ── EVENTS ───────────────────────────────────────────────────────────

  _bindEvents() {
    document.getElementById('dash-wissel-knop')?.addEventListener('click', () => {
      this._deps.autoManager?._toonWisselPicker?.();
    });

    document.getElementById('dash-widgets-knop')?.addEventListener('click', () => {
      this._openWidgetCustomizer();
    });

    document.querySelectorAll('#desktop-dashboard [data-actie]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._verwerkActie(btn.dataset.actie, btn);
      });
    });

    document.querySelectorAll('#desktop-dashboard .widget[data-widget]').forEach((w) => {
      if (!EXPANDABLE.includes(w.dataset.widget)) return;
      w.style.cursor = 'pointer';
      w.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this._expand(w);
      });
    });

    document.getElementById('dash-backdrop')?.addEventListener('click', () => this._collapse());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._geExpanded) this._collapse();
    });
  }

  _verwerkActie(actie, btn) {
    if (actie === 'nieuwe-rit')        return this._modals.openRit();
    if (actie === 'nieuwe-tank')       return this._modals.openTank();
    if (actie === 'nieuwe-vk')         return this._modals.openVk();
    if (actie === 'afrekenen')         return this._deps.afreken?.openSheet?.();
    if (actie === 'instellingen') {
      // Op desktop is er geen aparte instellingen-tab, maar op kleinere
      // schermen kan deze knop wel zichtbaar worden — fallback naar tab.
      document.querySelector('.nav-btn[data-tab="instellingen"]')?.click();
      return;
    }
    if (actie === 'widgets')           return this._openWidgetCustomizer();
    if (actie === 'expand') {
      const widget = btn.closest('.widget');
      if (widget) this._expand(widget);
    }
  }

  // ── WIDGET CUSTOMIZER ────────────────────────────────────────────────
  _openWidgetCustomizer() {
    const huidig = this._db.getDesktopWidgets() || DEFAULT_KEUZE;
    this._modals.openWidgets(huidig, WIDGET_META, (nieuw) => {
      // Sla álleen op als er minstens één widget actief is — anders blijft
      // het dashboard leeg en heeft de gebruiker geen knop om het te openen.
      if (!nieuw || !nieuw.length) {
        this._db.setDesktopWidgets(DEFAULT_KEUZE);
      } else {
        this._db.setDesktopWidgets(nieuw);
      }
    });
  }

  _pasZichtbaarheidToe() {
    const keuze = this._db.getDesktopWidgets() || DEFAULT_KEUZE;
    const aktief = new Set(keuze);
    document.querySelectorAll('#desktop-dashboard .widget[data-widget]').forEach((w) => {
      const aan = aktief.has(w.dataset.widget);
      w.classList.toggle('widget-verborgen', !aan);
    });
  }

  // ── EXPAND / COLLAPSE ────────────────────────────────────────────────

  _expand(widgetEl) {
    if (this._geExpanded === widgetEl) return;
    this._collapse();

    document.getElementById('dash-grid')?.classList.add('heeft-expanded');
    widgetEl.classList.add('is-expanded');
    this._geExpanded = widgetEl;

    this._injecteerSluitKnop(widgetEl);

    // Vraag de juiste widget om zijn expanded-render te doen
    const widgetKey = widgetEl.dataset.widget;
    const widget = this._widgets[widgetKey];
    if (widget && typeof widget.renderExpanded === 'function') {
      widget.renderExpanded(this._db.getGeselecteerdeAuto());
    }
  }

  _collapse() {
    if (!this._geExpanded) return;
    document.getElementById('dash-grid')?.classList.remove('heeft-expanded');
    this._geExpanded.classList.remove('is-expanded');

    const kop = this._geExpanded.querySelector('.widget-kop');
    if (kop) {
      kop.querySelector('.widget-sluit')?.remove();
      const actie = kop.querySelector('.widget-actie');
      if (actie) actie.style.display = '';
    }

    this._geExpanded = null;
    const auto = this._db.getGeselecteerdeAuto();
    if (auto) this.render();
  }

  _injecteerSluitKnop(widgetEl) {
    const kop = widgetEl.querySelector('.widget-kop');
    if (!kop || kop.querySelector('.widget-sluit')) return;

    const sluit = document.createElement('button');
    sluit.className = 'widget-sluit';
    sluit.type = 'button';
    sluit.setAttribute('aria-label', 'Sluit widget');
    sluit.innerHTML = '✕';
    sluit.addEventListener('click', (e) => {
      e.stopPropagation();
      this._collapse();
    });

    const actie = kop.querySelector('.widget-actie');
    if (actie) actie.style.display = 'none';
    kop.appendChild(sluit);
  }

  // ── ANIMATIE: stagger-entrance ──────────────────────────────────────
  _staggerEntrance() {
    const widgets = document.querySelectorAll(
      '#desktop-dashboard .widget:not(.widget-verborgen)'
    );
    widgets.forEach((w, i) => {
      w.style.setProperty('--stagger-i', i);
      w.classList.remove('widget-entrance');
      // Reflow forceert restart van de animatie wanneer hij al een keer liep
      // (relevant bij wissel van layout). offsetWidth lezen volstaat.
      // eslint-disable-next-line no-unused-expressions
      w.offsetWidth;
      w.classList.add('widget-entrance');
    });
  }

  // ── HEADER + EMPTY STATE ────────────────────────────────────────────

  _renderHeader(auto) {
    const naam = document.getElementById('dash-auto-naam');
    const merk = document.getElementById('dash-auto-merk');
    if (naam) naam.textContent = auto.naam || '—';
    if (merk) merk.textContent = auto.merk || auto.type || '—';
  }

  _toonGeenAuto() {
    const val = document.getElementById('dash-saldo-val');
    if (val) val.textContent = '—';
    const uitleg = document.getElementById('dash-saldo-uitleg');
    if (uitleg) uitleg.textContent = 'Voeg eerst een auto toe om het dashboard te zien.';
  }
}

export default DesktopDashboard;
