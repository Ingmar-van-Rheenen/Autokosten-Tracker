// ── StatsController ───────────────────────────────────────────────────────────
// Beheert saldo-berekening, overzicht-statistieken, grafiek en auto-instellingen.
import { Utils } from '../core/Utils.js';
import { InfoOverlay } from '../ui/InfoOverlay.js';

export class StatsController {
  constructor(db) {
    this._db = db;
    this._periode = 'maand';
    this._periodeGebonden = false;
  }

  /** Zet de actieve periode-filter ('maand' | 'jaar' | 'alles') en re-render. */
  setPeriode(p) {
    if (!['maand', 'jaar', 'alles'].includes(p)) return;
    this._periode = p;
    document.querySelectorAll('.periode-filter button').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.periode === p ? 'true' : 'false');
    });
    this.updateOverzicht();
  }

  _bindPeriodeFilter() {
    if (this._periodeGebonden) return;
    const knoppen = document.querySelectorAll('.periode-filter button');
    if (!knoppen.length) return;
    this._periodeGebonden = true;
    knoppen.forEach((btn) => {
      btn.addEventListener('click', () => this.setPeriode(btn.dataset.periode));
    });
  }

  updateSaldo() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;

    const { betaald, verschuldigd } = this._berekenKosten(auto);
    // Saldo inclusief geregistreerde betalingen zodat dit getal consistent
    // is met de Afrekenen-sheet — anders blijft het verschil staan na een
    // markeer-als-afgerekend actie.
    const betalingenDelta = this._berekenBetalingenDelta(auto);
    const saldo = betaald + betalingenDelta - verschuldigd;

    const el = document.getElementById('saldo-val');
    el.textContent = (saldo >= 0 ? '+' : '−') + Utils.eur(saldo);
    el.className = 'saldo-hero-val ' + (saldo >= 0 ? 'positief' : 'negatief');
    document.getElementById('saldo-uitleg').textContent = saldo >= 0
      ? 'Je hebt meer getankt dan gereden — tegoed'
      : 'Je hebt meer gereden dan getankt — bij te storten';
  }

  /**
   * Som van betalingen die het saldo van de huidige gebruiker beïnvloeden.
   * Positief = ik betaalde (saldo stijgt), negatief = ik ontving (saldo daalt).
   * Herkent zowel het stabiele 'Ik' sentinel als de huidige naam.
   */
  _berekenBetalingenDelta(auto) {
    const betalingen = (typeof this._db.getAutoBetalingen === 'function')
      ? (this._db.getAutoBetalingen(auto.id) || []) : [];
    if (!betalingen.length) return 0;
    const eigenNaam = (this._db.load().naam || '').toLowerCase().trim();
    const isIk = (v) => {
      const x = (v || '').toLowerCase().trim();
      if (!x) return false;
      if (x === 'ik') return true;
      return !!eigenNaam && x === eigenNaam;
    };
    return betalingen.reduce((acc, b) => {
      const bedrag = Number(b.bedrag || 0);
      if (isIk(b.naar)) return acc - bedrag;
      if (isIk(b.van)) return acc + bedrag;
      return acc;
    }, 0);
  }

  updateOverzicht() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;

    this._bindPeriodeFilter();

    const alleRitten = this._db.getAutoRitten(auto.id) || [];
    const alleTank = this._db.getAutoTankbeurten(auto.id) || [];
    const alleVk = (typeof this._db.getAutoVasteKosten === 'function')
      ? (this._db.getAutoVasteKosten(auto.id) || []) : [];

    const filterFn = (typeof Utils.filterOpPeriode === 'function')
      ? Utils.filterOpPeriode.bind(Utils) : (items) => items;
    const ritten = filterFn(alleRitten, this._periode);
    const tankbeurten = filterFn(alleTank, this._periode);

    const { betaald, verschuldigd, totalKm } = this._berekenKostenVoorScope(auto, ritten, tankbeurten);

    const ovKm = document.getElementById('ov-km');
    const ovRit = document.getElementById('ov-ritten');
    const ovBet = document.getElementById('ov-betaald');
    const ovKost = document.getElementById('ov-kosten');
    if (ovKm) ovKm.textContent = totalKm.toFixed(1).replace('.', ',');
    if (ovRit) ovRit.textContent = ritten.length;
    if (ovBet) ovBet.textContent = '€ ' + betaald.toFixed(2).replace('.', ',');
    if (ovKost) ovKost.textContent = '€ ' + verschuldigd.toFixed(2).replace('.', ',');

    // v3: canvas bar chart + per-auto stats grid — chart respecteert
    // de geselecteerde periode (maand/jaar/alles) voor consistentie met KPIs.
    if (document.getElementById('grafiek-canvas')) {
      this.renderBarChart(alleRitten, alleTank, alleVk, this._periode);
    } else {
      this._renderGrafiek(ritten);
    }
    this.renderPerAutoStats(auto, alleRitten, alleTank, alleVk);
  }

  // ── Canvas bar chart (v3) ────────────────────────────────────────────────

  renderBarChart(alleRitten, alleTank, alleVk, periode = 'alles') {
    const canvas = document.getElementById('grafiek-canvas');
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || canvas.width;
    const cssH = canvas.clientHeight || canvas.height;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // Buckets schalen mee met de geselecteerde periode:
    //   'maand' → 4 weken, 'jaar' → 12 maanden, anders 6 maanden.
    const now = new Date();
    const maanden = [];
    if (periode === 'maand') {
      // 4 weken eindigend op vandaag
      for (let i = 3; i >= 0; i--) {
        const eind = new Date(now);
        eind.setDate(eind.getDate() - i * 7);
        const begin = new Date(eind);
        begin.setDate(begin.getDate() - 6);
        maanden.push({
          modus: 'week',
          begin, eind,
          label: 'W' + (4 - i),
          brandstof: 0, vast: 0,
        });
      }
    } else {
      const aantal = periode === 'jaar' ? 12 : 6;
      for (let i = aantal - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        maanden.push({
          modus: 'maand',
          jaar: d.getFullYear(),
          maand: d.getMonth(),
          label: d.toLocaleString('nl-NL', { month: 'short' }).replace('.', ''),
          brandstof: 0,
          vast: 0,
        });
      }
    }

    const bucketIdx = (datum) => {
      if (!datum) return -1;
      const d = new Date(datum);
      if (isNaN(d.getTime())) return -1;
      if (maanden[0]?.modus === 'week') {
        return maanden.findIndex((m) => d >= m.begin && d <= m.eind);
      }
      return maanden.findIndex((m) => m.jaar === d.getFullYear() && m.maand === d.getMonth());
    };

    (alleTank || []).forEach((t) => {
      const i = bucketIdx(t.datum);
      if (i >= 0) maanden[i].brandstof += Number(t.totaal || 0);
    });

    (alleVk || []).forEach((v) => {
      const bedrag = Number(v.bedrag || 0);
      if (!bedrag) return;
      const start = v.start_datum ? new Date(v.start_datum) : null;
      const eind = v.eind_datum ? new Date(v.eind_datum) : null;
      maanden.forEach((m) => {
        const begin = m.modus === 'week' ? m.begin : new Date(m.jaar, m.maand, 1);
        const einde = m.modus === 'week' ? m.eind : new Date(m.jaar, m.maand + 1, 0);
        if (start && start > einde) return;
        if (eind && eind < begin) return;
        if (m.modus === 'week') {
          // Per-week pro-rata: maandelijks/12 → wekelijks (* 12/52), jaarlijks/52
          if (v.frequentie === 'jaarlijks') m.vast += bedrag / 52;
          else m.vast += (bedrag * 12) / 52;
        } else {
          if (v.frequentie === 'jaarlijks') m.vast += bedrag / 12;
          else m.vast += bedrag;
        }
      });
    });

    const max = Math.max(1, ...maanden.map((m) => m.brandstof + m.vast));
    // Round max up to a "nice" number for cleaner gridlines
    const niceMax = (n) => {
      const mag = Math.pow(10, Math.floor(Math.log10(n)));
      const v = n / mag;
      const step = v <= 1 ? 1 : v <= 2 ? 2 : v <= 5 ? 5 : 10;
      return step * mag;
    };
    const yMax = niceMax(max * 1.1);

    // Layout — meer ademruimte boven, smallere bars, kleinere x-as labels
    const padX = 20;
    const padTop = 28;
    const padBot = 32;
    const chartW = cssW - padX * 2;
    const chartH = cssH - padTop - padBot;
    const groepBreed = chartW / maanden.length;
    const barBreed = Math.max(10, Math.min(28, groepBreed * 0.42));
    const huidigeMaandIdx = maanden.length - 1;

    // Theme-aware kleuren
    const css = getComputedStyle(document.documentElement);
    const kleurBrandstof = css.getPropertyValue('--primair').trim() || '#2563EB';
    const kleurVast = css.getPropertyValue('--accent').trim() || css.getPropertyValue('--succes').trim() || '#10B981';
    const kleurTekst = css.getPropertyValue('--tekst').trim() || '#1b2537';
    const kleurTekstZwak = css.getPropertyValue('--tekst-zwak').trim() || '#7a8a9a';
    const kleurRand = css.getPropertyValue('--rand').trim() || '#e5e7eb';

    // Y-as: 4 gridlijnen (0, 25, 50, 75, 100% van yMax) — strakker dan 3
    ctx.lineWidth = 1;
    ctx.font = '9px ' + (css.getPropertyValue('--mono').trim() || 'Space Mono, monospace');
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const pct = i / 4;
      const y = padTop + chartH - chartH * pct;
      ctx.strokeStyle = i === 0 ? kleurRand : kleurRand + (kleurRand.length === 7 ? '80' : '');
      ctx.setLineDash(i === 0 ? [] : [2, 3]);
      ctx.beginPath();
      ctx.moveTo(padX + 18, y);
      ctx.lineTo(padX + chartW, y);
      ctx.stroke();
      if (yMax > 0) {
        const waarde = Math.round(pct * yMax);
        ctx.fillStyle = kleurTekstZwak;
        ctx.fillText('€' + waarde, padX + 14, y);
      }
    }
    ctx.setLineDash([]);

    // Rounded-cap bar helper
    const rondeBar = (x, y, w, h, r, kleur) => {
      if (h < 1) return;
      const rr = Math.min(r, h / 2, w / 2);
      ctx.fillStyle = kleur;
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
    };

    // Bars
    ctx.font = '10px ' + (css.getPropertyValue('--mono').trim() || 'Space Mono, monospace');
    maanden.forEach((m, idx) => {
      const cx = padX + 18 + (idx + 0.5) * ((chartW - 18) / maanden.length);
      const totaal = m.brandstof + m.vast;
      const hBrand = (m.brandstof / yMax) * chartH;
      const hVast = (m.vast / yMax) * chartH;
      const hTot = hBrand + hVast;

      const xBar = cx - barBreed / 2;
      const yBrand = padTop + chartH - hBrand;
      const yVast = yBrand - hVast;

      // Brandstof onderaan (geen ronde hoek boven als er vast erbovenop komt)
      if (hVast > 0.5) {
        ctx.fillStyle = kleurBrandstof;
        ctx.fillRect(xBar, yBrand, barBreed, hBrand);
      } else {
        rondeBar(xBar, yBrand, barBreed, hBrand, 4, kleurBrandstof);
      }
      // Vast bovenop met afgeronde top
      if (hVast > 0.5) {
        rondeBar(xBar, yVast, barBreed, hVast, 4, kleurVast);
      }

      // Bedrag label boven de stack (alleen als > 0)
      if (totaal > 0.005) {
        ctx.fillStyle = idx === huidigeMaandIdx ? kleurTekst : kleurTekstZwak;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = (idx === huidigeMaandIdx ? '700 ' : '') + '10px ' + (css.getPropertyValue('--mono').trim() || 'Space Mono, monospace');
        ctx.fillText('€' + Math.round(totaal), cx, padTop + chartH - hTot - 4);
        ctx.font = '10px ' + (css.getPropertyValue('--mono').trim() || 'Space Mono, monospace');
      }

      // X-as label (maand) — huidige maand bold
      ctx.fillStyle = idx === huidigeMaandIdx ? kleurTekst : kleurTekstZwak;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = (idx === huidigeMaandIdx ? '700 ' : '') + '10px ' + (css.getPropertyValue('--mono').trim() || 'Space Mono, monospace');
      ctx.fillText(m.label.toUpperCase(), cx, padTop + chartH + 8);
      ctx.font = '10px ' + (css.getPropertyValue('--mono').trim() || 'Space Mono, monospace');
    });

    // Legenda rechtsboven met ronde puntjes
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '9px ' + (css.getPropertyValue('--sans').trim() || 'system-ui, sans-serif');
    const legY = 12;
    let legX = padX + 18;
    const dot = (x, y, kleur) => {
      ctx.fillStyle = kleur;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    };
    dot(legX, legY, kleurBrandstof);
    legX += 8;
    ctx.fillStyle = kleurTekstZwak;
    ctx.fillText('brandstof', legX, legY);
    legX += 60;
    dot(legX, legY, kleurVast);
    legX += 8;
    ctx.fillStyle = kleurTekstZwak;
    ctx.fillText('vaste kosten', legX, legY);
  }

  // ── Per-auto stats grid (v3) ─────────────────────────────────────────────

  renderPerAutoStats(auto, alleRitten, alleTank, alleVk) {
    const el = document.getElementById('per-auto-stats');
    if (!el) return;

    // Periode-respecterende subset
    const filterFn = (typeof Utils.filterOpPeriode === 'function')
      ? Utils.filterOpPeriode.bind(Utils) : (items) => items;
    const periodeLbl = this._periode === 'jaar'
      ? 'Km dit jaar'
      : this._periode === 'alles'
        ? 'Km totaal'
        : 'Km deze maand';
    const rittenPeriode = this._periode === 'alles' ? (alleRitten || []) : filterFn(alleRitten, this._periode);
    const kmInPeriode = rittenPeriode.reduce((s, r) => s + Number(r.km || 0), 0);
    const kmTotaal = (alleRitten || []).reduce((s, r) => s + Number(r.km || 0), 0);

    const km100l = (typeof Utils.km100l === 'function')
      ? Utils.km100l(alleRitten, alleTank) : 0;
    const eurPerKm = (typeof Utils.kostenPerKm === 'function')
      ? Utils.kostenPerKm(alleRitten, alleTank, alleVk) : 0;

    const cellen = [
      { lbl: periodeLbl, val: kmInPeriode.toFixed(1).replace('.', ',') + ' km' },
      { lbl: 'Totaal km', val: kmTotaal.toFixed(0) + ' km' },
      { lbl: 'Gem. l/100km', val: km100l > 0 ? km100l.toFixed(1).replace('.', ',') : '—' },
      { lbl: '€ per km', val: eurPerKm > 0 ? '€ ' + eurPerKm.toFixed(2).replace('.', ',') : '—' },
    ];

    el.innerHTML = cellen.map((c) => `
      <div class="stat-cel">
        <div class="stat-label">${c.lbl}</div>
        <div class="stat-waarde">${c.val}</div>
      </div>
    `).join('');
  }

  _berekenKostenVoorScope(auto, ritten, tank) {
    // Hergebruik de bestaande Utils.berekenSaldo voor consistentie
    const { betaald, verschuldigd, gereden } = Utils.berekenSaldo(ritten, tank, auto);
    return { totalKm: gereden, betaald, verschuldigd };
  }

  updateInstellingen() {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;

    const d = this._db.load();
    this._renderAutoInstellingen(auto);
    this._renderTrackingInstelling();
    this._renderRevolutInstelling();
    this._renderBetaalverzoekInstelling();

    document.getElementById('inst-naam').value = d.naam || '';
    this._bindNaamOpslaan();
  }

  // ── SVG Grafiek ──────────────────────────────────────────────────────────

  _renderGrafiek(ritten) {
    const el = document.getElementById('grafiek-km');
    if (!el) return;

    const now = new Date();
    const maanden = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('nl-NL', { month: 'short' });
      maanden.push({ key, label, km: 0 });
    }

    ritten.forEach((r) => {
      const d = new Date(r.datum);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const m = maanden.find((m) => m.key === key);
      if (m) m.km += r.km;
    });

    const max = Math.max(...maanden.map((m) => m.km), 1);
    const barW = 32;
    const gap = 12;
    const H = 72;
    const W = (barW + gap) * 6 - gap;

    const bars = maanden.map((m, i) => {
      const h = Math.max(Math.round((m.km / max) * H), m.km > 0 ? 3 : 0);
      const x = i * (barW + gap);
      const val = m.km > 0
        ? `<text x="${x + barW / 2}" y="${H - h - 5}" text-anchor="middle" fill="#5e9464" font-size="9" font-family="monospace">${Math.round(m.km)}</text>`
        : '';
      return `
        <rect x="${x}" y="${H - h}" width="${barW}" height="${h}" fill="#4e7d52" rx="4" opacity="0.85"/>
        ${val}
        <text x="${x + barW / 2}" y="${H + 14}" text-anchor="middle" fill="#7a8a9a" font-size="10" font-family="sans-serif">${m.label}</text>
      `;
    }).join('');

    el.innerHTML = `
      <div class="grafiek-titel">KM PER MAAND</div>
      <svg viewBox="0 0 ${W} ${H + 20}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">${bars}</svg>
    `;
  }

  // ── Auto instellingen ────────────────────────────────────────────────────

  _renderAutoInstellingen(auto) {
    const elektrisch = auto.type === 'elektrisch';
    document.getElementById('auto-inst-form').innerHTML = `
      <div style="font-weight:600;font-size:0.95rem">${Utils.esc(auto.naam)}</div>
      ${elektrisch ? `
      <label class="form-lbl">Verbruik (kWh per 100 km)</label>
      <input type="number" id="inst-kml" class="form-input" step="0.1" min="1" value="${auto.kwh_per_100km}" />
      <label class="form-lbl">Laadprijs (€ per kWh)</label>
      <input type="number" id="inst-prijs" class="form-input" step="0.001" min="0" value="${auto.prijs_per_kwh}" />
      ` : `
      <label class="form-lbl">Verbruik (km per liter)</label>
      <input type="number" id="inst-kml" class="form-input" step="0.1" min="1" value="${auto.km_per_liter}" />
      <label class="form-lbl">Standaard brandstofprijs (€/L)</label>
      <input type="number" id="inst-prijs" class="form-input" step="0.001" min="0" value="${auto.prijs_per_liter}" />
      `}
      <button id="btn-auto-inst-opslaan" class="btn-form-primary">Opslaan</button>
    `;

    document.getElementById('btn-auto-inst-opslaan').addEventListener('click', () => {
      this._slaAutoInstellingenOp();
    });
  }

  _slaAutoInstellingenOp() {
    const kml = parseFloat(document.getElementById('inst-kml').value);
    const prijs = parseFloat(document.getElementById('inst-prijs').value);
    if (!(kml > 0) || !(prijs > 0)) return;

    const d = this._db.load();
    const auto = d.autos.find((a) => a.id === d.geselecteerd);
    if (!auto) return;

    if (auto.type === 'elektrisch') {
      auto.kwh_per_100km = kml;
      auto.prijs_per_kwh = prijs;
    } else {
      auto.km_per_liter = kml;
      auto.prijs_per_liter = prijs;
    }
    this._db.save(d);

    const merk = auto.merk ? auto.merk.toUpperCase() : '';
    const bsEl = document.getElementById('bs-auto-naam');
    if (bsEl) bsEl.textContent = auto.naam.toUpperCase() + (merk ? ' · ' + merk : '');

    Utils.toast('Instellingen opgeslagen ✓');
  }

  _renderTrackingInstelling() {
    const chk = document.getElementById('chk-smart-tracking');
    if (!chk) return;

    chk.checked = this._db.getSmartTracking();

    // Kloon om oude listeners te verwijderen
    const nieuw = chk.cloneNode(true);
    chk.parentNode.replaceChild(nieuw, chk);
    nieuw.checked = this._db.getSmartTracking();

    nieuw.addEventListener('change', () => {
      if (nieuw.checked) {
        // Toon waarschuwing eerst, sla pas op na bevestiging
        nieuw.checked = false;
        InfoOverlay.toon('smart', () => {
          this._db.setSmartTracking(true);
          const el = document.getElementById('chk-smart-tracking');
          if (el) el.checked = true;
        });
      } else {
        this._db.setSmartTracking(false);
      }
    });

    document.getElementById('btn-smart-info')?.addEventListener('click', () => {
      InfoOverlay.toon('smart');
    });
  }

  _renderRevolutInstelling() {
    const inp = document.getElementById('revolut-username-inp');
    if (!inp) return;
    inp.value = this._db.getRevolutUsername();
  }

  _renderBetaalverzoekInstelling() {
    const revolut = document.getElementById('revolut-username-inp');
    const bunqInp = document.getElementById('betaalverzoek-username-inp');
    const tikkieInp = document.getElementById('tikkie-handle-inp');
    const saveBtn = document.getElementById('btn-betaalverzoek-save');
    if (!saveBtn) return;

    if (bunqInp) bunqInp.value = this._db.getBetaalverzoekUsername();
    if (tikkieInp && typeof this._db.getTikkieHandle === 'function') {
      tikkieInp.value = this._db.getTikkieHandle();
    }

    const nieuw = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(nieuw, saveBtn);
    nieuw.addEventListener('click', () => {
      if (revolut) this._db.setRevolutUsername(revolut.value.trim().replace(/^revolut\.me\//i, ''));
      if (bunqInp) this._db.setBetaalverzoekUsername(bunqInp.value.trim().replace(/^bunq\.me\//i, ''));
      if (tikkieInp && typeof this._db.setTikkieHandle === 'function') {
        this._db.setTikkieHandle(tikkieInp.value.trim().replace(/^tikkie\.me\//i, ''));
      }
      Utils.toast('Betaalverzoek instellingen opgeslagen ✓');
    });
  }

  _bindNaamOpslaan() {
    const btn = document.getElementById('btn-naam');
    const nieuw = btn.cloneNode(true);
    btn.parentNode.replaceChild(nieuw, btn);
    nieuw.addEventListener('click', () => {
      const naam = document.getElementById('inst-naam').value.trim();
      const d = this._db.load();
      d.naam = naam;
      this._db.save(d);
      Utils.toast('Naam opgeslagen ✓');
    });
  }

  // ── Berekeningen ─────────────────────────────────────────────────────────

  _berekenKosten(auto) {
    const ritten = this._db.getAutoRitten(auto.id);
    const tank = this._db.getAutoTankbeurten(auto.id);
    const { betaald, verschuldigd, gereden } = Utils.berekenSaldo(ritten, tank, auto);
    return { totalKm: gereden, betaald, verschuldigd };
  }
}
