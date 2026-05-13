// ── DesktopDashboard ─────────────────────────────────────────────────────────
// Vult en beheert het desktop-dashboard (#desktop-dashboard). Activeert pas op
// ≥1280px (CSS handelt zichtbaarheid af); JS rendert altijd zodra de DOM
// bestaat, ongeacht breedte, zodat een resize live werkt.
//
// Verantwoordelijkheden:
// - Widgets vullen op basis van Database state
// - Luisteren naar db:updated en thema:gewijzigd om opnieuw te renderen
// - Expand-in-place gedrag (klik op widget → 0.18 opacity op andere widgets)
// - Quick-action knoppen koppelen aan bestaande modal-flows
// - Thema-toggle koppelen aan ThemaController

import { Utils } from './Utils.js';
import { ThemaController } from './ThemaController.js';

export class DesktopDashboard {
  /**
   * @param {import('./Database.js').Database} db
   * @param {{
   *   afreken: import('./AfrekenController.js').AfrekenController,
   *   vasteKosten: import('./VasteKostenController.js').VasteKostenController,
   *   stats: import('./StatsController.js').StatsController,
   *   autoManager: import('./AutoManager.js').AutoManager,
   * }} deps
   */
  constructor(db, deps) {
    this._db = db;
    this._deps = deps;
    this._gebonden = false;
    this._geExpanded = null; // momenteel uitgeklapte widget-element
  }

  /** Bind events één keer en doe een eerste render. */
  init() {
    if (this._gebonden) return;
    this._gebonden = true;

    this._bindEvents();
    this.render();

    // Re-render bij elke database-mutatie en thema-wissel
    window.addEventListener('db:updated', () => this.render());
    window.addEventListener('thema:gewijzigd', () => this._renderThemaToggle());
  }

  /** Volledige render van alle widgets. */
  render() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) {
      this._toonGeenAuto();
      return;
    }

    this._renderHeader(auto);
    this._renderSaldo(auto);
    this._renderTrend(auto);
    this._renderRitten(auto);
    this._renderTank(auto);
    this._renderVasteKosten(auto);
    this._renderStats(auto);
    this._renderKaart(auto);
    this._renderThemaToggle();
  }

  // ── EVENTS ───────────────────────────────────────────────────────────

  _bindEvents() {
    // Auto-wissel knop hergebruikt bestaande wissel-picker
    document.getElementById('dash-wissel-knop')?.addEventListener('click', () => {
      this._deps.autoManager?._toonWisselPicker?.();
    });

    // Widget acties (Open / Afrekenen / Alle instellingen)
    document.querySelectorAll('#desktop-dashboard [data-actie]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const actie = btn.dataset.actie;
        this._verwerkActie(actie, btn);
      });
    });

    // Klik op widget zelf opent expand-mode (behalve op de actie-knop zelf)
    document.querySelectorAll('#desktop-dashboard .widget[data-widget]').forEach((w) => {
      const widget = w.dataset.widget;
      if (!['ritten', 'tank', 'vk', 'kaart'].includes(widget)) return;
      w.style.cursor = 'pointer';
      w.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; // laat knoppen hun ding doen
        this._expand(w);
      });
    });

    // Backdrop sluit expanded widget
    document.getElementById('dash-backdrop')?.addEventListener('click', () => this._collapse());

    // ESC sluit expanded widget
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._geExpanded) this._collapse();
    });

    // Thema-knoppen
    document.querySelectorAll('.dash-thema-knop').forEach((btn) => {
      btn.addEventListener('click', () => {
        const thema = btn.dataset.thema;
        if (thema) ThemaController.set(thema);
      });
    });
  }

  _verwerkActie(actie, btn) {
    switch (actie) {
      case 'afrekenen':
        this._deps.afreken?.openSheet?.();
        break;
      case 'nieuwe-rit':
        // Spring naar de Rit-tab (kaart)
        document.querySelector('.nav-btn[data-tab="kaart"]')?.click();
        break;
      case 'nieuwe-tank':
        document.querySelector('.nav-btn[data-tab="saldo"]')?.click();
        break;
      case 'nieuwe-vk':
        this._deps.vasteKosten?.openSheet?.();
        break;
      case 'instellingen':
        document.querySelector('.nav-btn[data-tab="instellingen"]')?.click();
        break;
      case 'expand': {
        const widget = btn.closest('.widget');
        if (widget) this._expand(widget);
        break;
      }
    }
  }

  // ── EXPAND / COLLAPSE ────────────────────────────────────────────────

  _expand(widgetEl) {
    if (this._geExpanded === widgetEl) return;
    this._collapse(); // sluit eventuele andere expanded

    const grid = document.getElementById('dash-grid');
    grid?.classList.add('heeft-expanded');
    widgetEl.classList.add('is-expanded');
    this._geExpanded = widgetEl;

    // Voeg sluit-knop toe als die nog niet bestaat
    const kop = widgetEl.querySelector('.widget-kop');
    if (kop && !kop.querySelector('.widget-sluit')) {
      const sluit = document.createElement('button');
      sluit.className = 'widget-sluit';
      sluit.type = 'button';
      sluit.setAttribute('aria-label', 'Sluit widget');
      sluit.innerHTML = '✕';
      sluit.addEventListener('click', (e) => {
        e.stopPropagation();
        this._collapse();
      });
      // Vervang de actie-knop tijdens expanded zicht
      const actie = kop.querySelector('.widget-actie');
      if (actie) actie.style.display = 'none';
      kop.appendChild(sluit);
    }

    // Render de uitgebreide inhoud
    this._renderExpanded(widgetEl);
  }

  _collapse() {
    if (!this._geExpanded) return;
    const grid = document.getElementById('dash-grid');
    grid?.classList.remove('heeft-expanded');
    this._geExpanded.classList.remove('is-expanded');

    // Verwijder sluit-knop en toon de actie-knop weer
    const kop = this._geExpanded.querySelector('.widget-kop');
    if (kop) {
      kop.querySelector('.widget-sluit')?.remove();
      const actie = kop.querySelector('.widget-actie');
      if (actie) actie.style.display = '';
    }

    this._geExpanded = null;
    // Re-render om compacte staat te herstellen
    const auto = this._db.getGeselecteerdeAuto();
    if (auto) this.render();
  }

  _renderExpanded(widgetEl) {
    const widget = widgetEl.dataset.widget;
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;

    if (widget === 'ritten') {
      const ritten = this._db.getAutoRitten(auto.id) || [];
      const lijst = widgetEl.querySelector('#dash-ritten-lijst');
      if (lijst) lijst.innerHTML = this._renderRittenRows(ritten, 20);
    } else if (widget === 'tank') {
      const tank = this._db.getAutoTankbeurten(auto.id) || [];
      const lijst = widgetEl.querySelector('#dash-tank-lijst');
      if (lijst) lijst.innerHTML = this._renderTankRows(tank, 20, auto.type === 'elektrisch');
    } else if (widget === 'vk') {
      const vk = this._db.getAutoVasteKosten?.(auto.id) || [];
      const lijst = widgetEl.querySelector('#dash-vk-lijst');
      if (lijst) lijst.innerHTML = this._renderVkRows(vk, 20);
    }
  }

  // ── HEADER ───────────────────────────────────────────────────────────

  _renderHeader(auto) {
    const naam = document.getElementById('dash-auto-naam');
    const merk = document.getElementById('dash-auto-merk');
    if (naam) naam.textContent = auto.naam || '—';
    if (merk) merk.textContent = auto.merk || auto.type || '—';
  }

  // ── SALDO WIDGET ────────────────────────────────────────────────────

  _renderSaldo(auto) {
    const ritten = this._db.getAutoRitten(auto.id) || [];
    const tank = this._db.getAutoTankbeurten(auto.id) || [];
    const vk = this._db.getAutoVasteKosten?.(auto.id) || [];
    const betalingen = this._db.getAutoBetalingen?.(auto.id) || [];

    const { saldo, betaald, gereden } = Utils.berekenSaldo(ritten, tank, auto);
    // Vaste kosten + betalingen worden door AfrekenController meegeteld, maar
    // voor de hero-tegel houden we het simpel: saldo zoals berekend door Utils.

    const val = document.getElementById('dash-saldo-val');
    const uitleg = document.getElementById('dash-saldo-uitleg');
    if (val) {
      val.textContent = (saldo >= 0 ? '+ ' : '− ') + Utils.eur(saldo);
      val.classList.remove('negatief', 'neutraal');
      if (saldo < -0.005) val.classList.add('negatief');
      else if (Math.abs(saldo) <= 0.005) val.classList.add('neutraal');
    }
    if (uitleg) {
      uitleg.textContent = saldo > 0.005
        ? 'Je hebt meer getankt dan gereden. Vraag het bedrag terug.'
        : saldo < -0.005
          ? 'Je hebt meer gereden dan getankt. Tijd om af te rekenen.'
          : 'Niets meer te verrekenen.';
    }

    const km = document.getElementById('dash-saldo-km');
    if (km) km.textContent = gereden.toFixed(1).replace('.', ',') + ' km';

    const brand = document.getElementById('dash-saldo-brand');
    if (brand) brand.textContent = Utils.eur(betaald);

    const vasteTot = vk.reduce((acc, v) => {
      const b = Number(v.bedrag || 0);
      return acc + (v.frequentie === 'jaarlijks' ? b / 12 : b);
    }, 0);
    const vast = document.getElementById('dash-saldo-vast');
    if (vast) vast.textContent = Utils.eur(vasteTot) + ' /m';
  }

  // ── TREND CHART ──────────────────────────────────────────────────────

  _renderTrend(auto) {
    const canvas = document.getElementById('dash-trend-canvas');
    if (!canvas || !canvas.getContext) return;

    const ritten = this._db.getAutoRitten(auto.id) || [];
    const tank = this._db.getAutoTankbeurten(auto.id) || [];
    const vk = this._db.getAutoVasteKosten?.(auto.id) || [];

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 600;
    const cssH = canvas.clientHeight || 220;
    if (canvas.width !== Math.round(cssW * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // 6-maand buckets
    const now = new Date();
    const maanden = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      maanden.push({
        jaar: d.getFullYear(),
        maand: d.getMonth(),
        label: d.toLocaleString('nl-NL', { month: 'short' }).replace('.', ''),
        brand: 0,
        vast: 0,
      });
    }

    const bucketIdx = (datum) => {
      if (!datum) return -1;
      const d = new Date(datum);
      if (isNaN(d.getTime())) return -1;
      return maanden.findIndex((m) => m.jaar === d.getFullYear() && m.maand === d.getMonth());
    };

    tank.forEach((t) => {
      const i = bucketIdx(t.datum);
      if (i >= 0) maanden[i].brand += Number(t.totaal || 0);
    });

    vk.forEach((v) => {
      const bedrag = Number(v.bedrag || 0);
      if (!bedrag) return;
      maanden.forEach((m) => {
        const start = v.start_datum ? new Date(v.start_datum) : null;
        const eind = v.eind_datum ? new Date(v.eind_datum) : null;
        const eersteDag = new Date(m.jaar, m.maand, 1);
        const laatsteDag = new Date(m.jaar, m.maand + 1, 0);
        if (start && start > laatsteDag) return;
        if (eind && eind < eersteDag) return;
        m.vast += v.frequentie === 'jaarlijks' ? bedrag / 12 : bedrag;
      });
    });

    const max = Math.max(1, ...maanden.map((m) => m.brand + m.vast));
    const niceMax = (n) => {
      const mag = Math.pow(10, Math.floor(Math.log10(n)));
      const v = n / mag;
      const step = v <= 1 ? 1 : v <= 2 ? 2 : v <= 5 ? 5 : 10;
      return step * mag;
    };
    const yMax = niceMax(max * 1.1);

    const padL = 36, padR = 12, padT = 14, padB = 28;
    const chartW = cssW - padL - padR;
    const chartH = cssH - padT - padB;
    const groepBreed = chartW / maanden.length;
    const barBreed = Math.max(14, Math.min(40, groepBreed * 0.5));

    const css = getComputedStyle(document.documentElement);
    const kleurBrand = css.getPropertyValue('--green-lite').trim() || '#7ab87a';
    const kleurVast = css.getPropertyValue('--green').trim() || '#4e7d52';
    const kleurTekst = css.getPropertyValue('--txt-dark').trim() || '#dce8f4';
    const kleurZwak = css.getPropertyValue('--txt-dark-m').trim() || '#8a9ab0';
    const kleurRand = css.getPropertyValue('--dark-border').trim() || '#35445e';

    // Y-as gridlines
    ctx.lineWidth = 1;
    ctx.font = '10px Space Mono, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const pct = i / 4;
      const y = padT + chartH - chartH * pct;
      ctx.strokeStyle = i === 0 ? kleurRand : kleurRand + '60';
      ctx.setLineDash(i === 0 ? [] : [2, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();
      const waarde = Math.round(pct * yMax);
      ctx.fillStyle = kleurZwak;
      ctx.fillText('€' + waarde, padL - 6, y);
    }
    ctx.setLineDash([]);

    // Bars
    const huidige = maanden.length - 1;
    maanden.forEach((m, idx) => {
      const cx = padL + (idx + 0.5) * groepBreed;
      const hBrand = (m.brand / yMax) * chartH;
      const hVast = (m.vast / yMax) * chartH;
      const xBar = cx - barBreed / 2;
      const yBrand = padT + chartH - hBrand;
      const yVast = yBrand - hVast;

      // Brandstof bar
      ctx.fillStyle = kleurBrand;
      if (hVast > 0.5) {
        ctx.fillRect(xBar, yBrand, barBreed, hBrand);
      } else {
        this._rondeBar(ctx, xBar, yBrand, barBreed, hBrand, 4);
      }

      // Vast bovenop
      if (hVast > 0.5) {
        ctx.fillStyle = kleurVast;
        this._rondeBar(ctx, xBar, yVast, barBreed, hVast, 4);
      }

      // Label boven stack
      const totaal = m.brand + m.vast;
      if (totaal > 0.5) {
        ctx.fillStyle = idx === huidige ? kleurTekst : kleurZwak;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = (idx === huidige ? '700 ' : '') + '10px Space Mono, monospace';
        ctx.fillText('€' + Math.round(totaal), cx, yVast - 4);
      }

      // X-as label
      ctx.fillStyle = idx === huidige ? kleurTekst : kleurZwak;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = (idx === huidige ? '700 ' : '') + '10px Space Mono, monospace';
      ctx.fillText(m.label.toUpperCase(), cx, padT + chartH + 8);
    });
  }

  _rondeBar(ctx, x, y, w, h, r) {
    if (h < 1) return;
    const rr = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
    ctx.fill();
  }

  // ── RITTEN ───────────────────────────────────────────────────────────

  _renderRitten(auto) {
    const ritten = this._db.getAutoRitten(auto.id) || [];
    const lijst = document.getElementById('dash-ritten-lijst');
    if (!lijst) return;
    lijst.innerHTML = ritten.length
      ? this._renderRittenRows(ritten, 5)
      : '<li class="dash-mini-leeg">Nog geen ritten gelogd.</li>';
  }

  _renderRittenRows(ritten, limit) {
    return ritten.slice(0, limit).map((r) => {
      const datum = new Date(r.datum).toLocaleDateString('nl-NL', {
        day: 'numeric', month: 'short',
      });
      const km = Number(r.km || 0).toFixed(1).replace('.', ',');
      return `
        <li class="dash-mini-rij">
          <div>
            <div class="dash-mini-naam">${km} km</div>
            <span class="dash-mini-sub">${datum}${r.notitie ? ' · ' + Utils.esc(r.notitie) : ''}</span>
          </div>
        </li>`;
    }).join('');
  }

  // ── TANKBEURTEN ──────────────────────────────────────────────────────

  _renderTank(auto) {
    const tank = this._db.getAutoTankbeurten(auto.id) || [];
    const lijst = document.getElementById('dash-tank-lijst');
    if (!lijst) return;
    lijst.innerHTML = tank.length
      ? this._renderTankRows(tank, 5, auto.type === 'elektrisch')
      : '<li class="dash-mini-leeg">Nog geen tankbeurten.</li>';
  }

  _renderTankRows(tank, limit, elektrisch) {
    const eenheid = elektrisch ? 'kWh' : 'L';
    return tank.slice(0, limit).map((t) => {
      const datum = new Date(t.datum).toLocaleDateString('nl-NL', {
        day: 'numeric', month: 'short',
      });
      const hoeveelheid = Number(t.liters || 0).toFixed(2).replace('.', ',');
      const totaal = Utils.eur(Number(t.totaal || 0));
      return `
        <li class="dash-mini-rij">
          <div>
            <div class="dash-mini-naam">${hoeveelheid} ${eenheid}</div>
            <span class="dash-mini-sub">${datum}</span>
          </div>
          <span class="dash-mini-val">${totaal}</span>
        </li>`;
    }).join('');
  }

  // ── VASTE KOSTEN ─────────────────────────────────────────────────────

  _renderVasteKosten(auto) {
    const vk = this._db.getAutoVasteKosten?.(auto.id) || [];
    const lijst = document.getElementById('dash-vk-lijst');
    if (!lijst) return;

    if (!vk.length) {
      lijst.innerHTML = '<li class="dash-mini-leeg">Nog geen vaste kosten.</li>';
      return;
    }

    const rijen = this._renderVkRows(vk, 4);
    const totaal = vk.reduce((acc, v) => {
      const b = Number(v.bedrag || 0);
      return acc + (v.frequentie === 'jaarlijks' ? b / 12 : b);
    }, 0);

    lijst.innerHTML = rijen + `
      <li class="dash-vk-totaal">
        <span class="dash-vk-totaal-lbl">Per maand</span>
        <span class="dash-vk-totaal-val">${Utils.eur(totaal)}</span>
      </li>`;
  }

  _renderVkRows(vk, limit) {
    return vk.slice(0, limit).map((v) => {
      const bedrag = Number(v.bedrag || 0);
      const perMaand = v.frequentie === 'jaarlijks' ? bedrag / 12 : bedrag;
      return `
        <li class="dash-vk-rij">
          <span class="dash-vk-naam">${Utils.esc(v.label || v.type || 'Onbekend')}</span>
          <span class="dash-vk-bedrag">${Utils.eur(perMaand)}</span>
        </li>`;
    }).join('');
  }

  // ── AUTO-STATS ───────────────────────────────────────────────────────

  _renderStats(auto) {
    const ritten = this._db.getAutoRitten(auto.id) || [];
    const tank = this._db.getAutoTankbeurten(auto.id) || [];
    const vk = this._db.getAutoVasteKosten?.(auto.id) || [];

    const totaalKm = ritten.reduce((s, r) => s + Number(r.km || 0), 0);
    const km100l = typeof Utils.km100l === 'function' ? Utils.km100l(ritten, tank) : 0;
    const eurPerKm = typeof Utils.kostenPerKm === 'function'
      ? Utils.kostenPerKm(ritten, tank, vk) : 0;

    const cellen = [
      { lbl: 'Totaal', val: totaalKm.toFixed(0), sub: 'KM' },
      { lbl: 'Ritten', val: String(ritten.length), sub: '' },
      { lbl: 'Verbruik', val: km100l > 0 ? km100l.toFixed(1).replace('.', ',') : '—', sub: 'L/100KM' },
      { lbl: '€ per km', val: eurPerKm > 0 ? Utils.eur(eurPerKm).replace('€ ', '€') : '—', sub: '' },
    ];

    const grid = document.getElementById('dash-stats-grid');
    if (!grid) return;
    grid.innerHTML = cellen.map((c) => `
      <div class="dash-stat-cel">
        <div class="dash-stat-cel-lbl">${c.lbl}</div>
        <div class="dash-stat-cel-val">${c.val}</div>
        ${c.sub ? `<div class="dash-stat-cel-sub">${c.sub}</div>` : ''}
      </div>
    `).join('');
  }

  // ── KAART THUMBNAIL ──────────────────────────────────────────────────

  _renderKaart(auto) {
    const ritten = this._db.getAutoRitten(auto.id) || [];
    const laatste = ritten.find((r) => Array.isArray(r.gps_track) && r.gps_track.length >= 2);

    const wrap = document.getElementById('dash-kaart-wrap');
    const datumEl = document.getElementById('dash-kaart-datum');
    const kmEl = document.getElementById('dash-kaart-km');
    const svg = document.getElementById('dash-kaart-svg');
    if (!wrap || !svg) return;

    if (!laatste || !laatste.gps_track) {
      svg.innerHTML = '';
      if (datumEl) datumEl.textContent = '';
      if (kmEl) kmEl.textContent = '';
      wrap.classList.add('leeg');
      if (!wrap.querySelector('.dash-kaart-leeg')) {
        const p = document.createElement('p');
        p.className = 'dash-kaart-leeg';
        p.textContent = 'Smart-tracking nog niet gebruikt. Logging een rit met GPS-tracking om de route hier te zien.';
        wrap.appendChild(p);
      }
      return;
    }

    wrap.classList.remove('leeg');
    wrap.querySelector('.dash-kaart-leeg')?.remove();

    // Normaliseer track naar 320×120 viewBox
    const pts = laatste.gps_track;
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const rangeLat = Math.max(0.0001, maxLat - minLat);
    const rangeLng = Math.max(0.0001, maxLng - minLng);
    const pad = 12;
    const w = 320 - pad * 2;
    const h = 120 - pad * 2;

    const xy = pts.map(([lat, lng]) => {
      const x = pad + ((lng - minLng) / rangeLng) * w;
      const y = pad + (1 - (lat - minLat) / rangeLat) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    svg.innerHTML = `<polyline class="dash-kaart-route" points="${xy.join(' ')}"/>`;

    if (datumEl) {
      datumEl.textContent = new Date(laatste.datum).toLocaleDateString('nl-NL', {
        day: 'numeric', month: 'short',
      });
    }
    if (kmEl) {
      kmEl.textContent = Number(laatste.km || 0).toFixed(1).replace('.', ',') + ' km';
    }
  }

  // ── THEMA TOGGLE ────────────────────────────────────────────────────

  _renderThemaToggle() {
    const huidig = (this._db.getThema && this._db.getThema()) || 'klassiek';
    const norm = huidig === 'auto' ? 'klassiek' : huidig;
    document.querySelectorAll('.dash-thema-knop').forEach((btn) => {
      btn.classList.toggle('actief', btn.dataset.thema === norm);
    });
  }

  // ── GEEN AUTO ───────────────────────────────────────────────────────

  _toonGeenAuto() {
    const grid = document.getElementById('dash-grid');
    if (!grid) return;
    // Minimaal: leeg de saldo-velden
    const val = document.getElementById('dash-saldo-val');
    if (val) val.textContent = '—';
    const uitleg = document.getElementById('dash-saldo-uitleg');
    if (uitleg) uitleg.textContent = 'Voeg eerst een auto toe om het dashboard te zien.';
  }
}

export default DesktopDashboard;
