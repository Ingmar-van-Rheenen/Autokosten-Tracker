// ── DesktopDashboard ─────────────────────────────────────────────────────────
// Orchestrator voor het desktop-dashboard (≥1280px). Houdt zelf geen widget-
// state bij; iedere widget is een aparte class met een render(auto) methode.
// Verantwoordelijkheden:
//   - Widgets instantiëren en hun render() coordineren
//   - Luisteren naar db:updated + thema:gewijzigd om opnieuw te renderen
//   - Expand-in-place gedrag (klik op widget → andere widgets 0.18 opacity)
//   - Quick-actions koppelen aan bestaande modal-flows en mobiele tabs
import { SaldoWidget } from './widgets/SaldoWidget.js';
import { TrendWidget } from './widgets/TrendWidget.js';
import { RittenWidget } from './widgets/RittenWidget.js';
import { TankWidget } from './widgets/TankWidget.js';
import { VasteKostenWidget } from './widgets/VasteKostenWidget.js';
import { StatsWidget } from './widgets/StatsWidget.js';
import { KaartWidget } from './widgets/KaartWidget.js';
import { QuickActionsWidget } from './widgets/QuickActionsWidget.js';
import { ThemaWidget } from './widgets/ThemaWidget.js';

/** Widgets die uitklapbaar zijn (klik op de tegel opent expand-in-place). */
const EXPANDABLE = ['ritten', 'tank', 'vk', 'kaart'];

export class DesktopDashboard {
  constructor(db, deps) {
    this._db = db;
    this._deps = deps;
    this._gebonden = false;
    this._geExpanded = null;

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
    this.render();
    window.addEventListener('db:updated', () => this.render());
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
  }

  // ── EVENTS ───────────────────────────────────────────────────────────

  _bindEvents() {
    document.getElementById('dash-wissel-knop')?.addEventListener('click', () => {
      this._deps.autoManager?._toonWisselPicker?.();
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
    const TAB_KLIKS = {
      'nieuwe-rit': 'kaart',
      'nieuwe-tank': 'saldo',
      'instellingen': 'instellingen',
    };
    if (TAB_KLIKS[actie]) {
      document.querySelector(`.nav-btn[data-tab="${TAB_KLIKS[actie]}"]`)?.click();
      return;
    }
    if (actie === 'afrekenen') {
      this._deps.afreken?.openSheet?.();
    } else if (actie === 'nieuwe-vk') {
      this._deps.vasteKosten?.openSheet?.();
    } else if (actie === 'expand') {
      const widget = btn.closest('.widget');
      if (widget) this._expand(widget);
    }
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
