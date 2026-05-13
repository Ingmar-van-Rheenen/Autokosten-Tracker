// ── SplashScene ───────────────────────────────────────────────────────────────
// Bouwt de v2 splash-scene op basis van het uur van de dag.
// 4 tijdsvariants: ochtend / dag / avond / nacht — elk met eigen
// hemellichaam (zon/maan), decoraties (sterren/wolken) en begroeting.

const TIJDEN = {
  ochtend: {
    bereik: [5, 9],
    groet: 'Goedemorgen',
  },
  dag: {
    bereik: [9, 17],
    groet: 'Hallo',
  },
  avond: {
    bereik: [17, 21],
    groet: 'Goedenavond',
  },
  nacht: {
    bereik: [21, 24, 0, 5], // wraps over middernacht
    groet: 'Goedenacht',
  },
};

export class SplashScene {
  /** Zet alle splash-elementen klaar op basis van de huidige tijd. */
  static mount() {
    const tijd = SplashScene._huidigeTijd();
    const splash = document.getElementById('screen-splash');
    if (!splash) return;
    splash.setAttribute('data-tijd', tijd);

    const groetEl = document.getElementById('splash-greeting');
    if (groetEl) groetEl.textContent = TIJDEN[tijd].groet;

    SplashScene._bouwHemel(tijd);
    SplashScene._bouwSterren(tijd);
    SplashScene._bouwWolken(tijd);
  }

  static _huidigeTijd() {
    const u = new Date().getHours();
    if (u >= 5 && u < 9)   return 'ochtend';
    if (u >= 9 && u < 17)  return 'dag';
    if (u >= 17 && u < 21) return 'avond';
    return 'nacht';
  }

  /** Plaats zon of maan met juiste positie en glow. */
  static _bouwHemel(tijd) {
    const el = document.getElementById('splash-celestial');
    if (!el) return;
    el.innerHTML = '';

    if (tijd === 'nacht') {
      el.innerHTML = `
        <div class="splash-moon">
          <div class="splash-moon-shape"></div>
          <div class="splash-moon-crater splash-moon-crater-1"></div>
          <div class="splash-moon-crater splash-moon-crater-2"></div>
          <div class="splash-moon-crater splash-moon-crater-3"></div>
        </div>`;
    } else {
      el.innerHTML = `
        <div class="splash-sun">
          <div class="splash-sun-glow"></div>
          <div class="splash-sun-core"></div>
        </div>`;
    }
  }

  /** Sterrenveld — alleen 's nachts, ~40 willekeurige sterren met twinkle. */
  static _bouwSterren(tijd) {
    const el = document.getElementById('splash-stars');
    if (!el) return;
    if (tijd !== 'nacht') {
      el.innerHTML = '';
      return;
    }

    const sterren = [];
    for (let i = 0; i < 42; i++) {
      const x = Math.random() * 100;
      const y = Math.random() * 65; // alleen boven de horizon
      const size = Math.random() < 0.18 ? 2.4 : 1.4;
      const delay = (Math.random() * 4).toFixed(2);
      const duur = (2.5 + Math.random() * 2.5).toFixed(2);
      sterren.push(
        `<span class="splash-ster" style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;animation-delay:${delay}s;animation-duration:${duur}s"></span>`
      );
    }
    el.innerHTML = sterren.join('');
  }

  /** Drijvende wolken — bij ochtend/dag/avond, niet 's nachts. */
  static _bouwWolken(tijd) {
    const el = document.getElementById('splash-clouds');
    if (!el) return;
    if (tijd === 'nacht') {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = `
      <div class="splash-wolk splash-wolk-1"></div>
      <div class="splash-wolk splash-wolk-2"></div>
      <div class="splash-wolk splash-wolk-3"></div>
    `;
  }
}

export default SplashScene;
