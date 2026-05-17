// ── TrendWidget ──────────────────────────────────────────────────────────────
// 6-maand stacked bar chart: brandstof (groen-lite) + vaste kosten (groen).
// DPR-aware canvas, theme-aware kleuren via getComputedStyle.

export class TrendWidget {
  constructor(db) {
    this._db = db;
  }

  render(auto) {
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

    const maanden = this._buildMaanden(tank, vk);
    const yMax = this._niceMax(Math.max(1, ...maanden.map((m) => m.brand + m.vast)) * 1.1);

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

    this._tekenGrid(ctx, padL, padT, chartW, chartH, yMax, kleurRand, kleurZwak);
    this._tekenBars(ctx, maanden, padL, padT, chartW, chartH, groepBreed, barBreed, yMax,
      { kleurBrand, kleurVast, kleurTekst, kleurZwak });
  }

  _buildMaanden(tank, vk) {
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

    return maanden;
  }

  _niceMax(n) {
    const mag = Math.pow(10, Math.floor(Math.log10(n)));
    const v = n / mag;
    const step = v <= 1 ? 1 : v <= 2 ? 2 : v <= 5 ? 5 : 10;
    return step * mag;
  }

  _tekenGrid(ctx, padL, padT, chartW, chartH, yMax, kleurRand, kleurZwak) {
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
      ctx.fillStyle = kleurZwak;
      ctx.fillText('€' + Math.round(pct * yMax), padL - 6, y);
    }
    ctx.setLineDash([]);
  }

  _tekenBars(ctx, maanden, padL, padT, chartW, chartH, groepBreed, barBreed, yMax, kleuren) {
    const huidige = maanden.length - 1;
    maanden.forEach((m, idx) => {
      const cx = padL + (idx + 0.5) * groepBreed;
      const hBrand = (m.brand / yMax) * chartH;
      const hVast = (m.vast / yMax) * chartH;
      const xBar = cx - barBreed / 2;
      const yBrand = padT + chartH - hBrand;
      const yVast = yBrand - hVast;

      ctx.fillStyle = kleuren.kleurBrand;
      if (hVast > 0.5) {
        ctx.fillRect(xBar, yBrand, barBreed, hBrand);
      } else {
        this._rondeBar(ctx, xBar, yBrand, barBreed, hBrand, 4);
      }

      if (hVast > 0.5) {
        ctx.fillStyle = kleuren.kleurVast;
        this._rondeBar(ctx, xBar, yVast, barBreed, hVast, 4);
      }

      const totaal = m.brand + m.vast;
      if (totaal > 0.5) {
        ctx.fillStyle = idx === huidige ? kleuren.kleurTekst : kleuren.kleurZwak;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = (idx === huidige ? '700 ' : '') + '10px Space Mono, monospace';
        ctx.fillText('€' + Math.round(totaal), cx, yVast - 4);
      }

      ctx.fillStyle = idx === huidige ? kleuren.kleurTekst : kleuren.kleurZwak;
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
}

export default TrendWidget;
