// ── InfoOverlay ───────────────────────────────────────────────────────────────
// Gedeeld volledig-scherm info-overlay component
import { Utils } from './Utils.js';

const CONFIGS = {
  smart: {
    chip: 'WAARSCHUWING',
    chipKleur: '#f59e0b',
    titel: 'Slimme km-meting',
    tekst: 'De app volgt je GPS continu en houdt je scherm wakker. Omgereden kilometers worden zo wél geteld.\n\nBlijf in de app en vergrendel het scherm niet, anders stopt de tracking.',
    btn: 'Begrepen',
    visual: _smartVisual,
  },
  km: {
    chip: 'INFO',
    chipKleur: '#7ab87a',
    titel: 'Waarom dit veld?',
    tekst: 'De app berekent normaal de kortste route tussen start en eindpunt. Ben je omgereden? Dan klopt dat niet.\n\nVul hier het verschil op je kilometerteller in voor een exacte waarde.',
    btn: 'Begrepen',
    visual: _kmVisual,
  },
  kaart: {
    chip: 'INFO',
    chipKleur: '#7ab87a',
    titel: 'Stadia Maps',
    tekst: 'Stadia heeft mooiere kaart-tiles dan de standaard CartoCDN — beter contrast, fijnere typografie, strakkere stijl.\n\nGratis te registreren (200.000 requests/maand voor persoonlijk gebruik). Op localhost werkt het al zonder key — voor productie: stadiamaps.com → registreer → kopieer key → plak hier.',
    btn: 'Begrepen',
    visual: _kaartVisual,
  },
};

function _smartVisual() {
  return `
    <div class="io-smart-scene">
      <div class="io-smart-route">
        <svg viewBox="0 0 240 100" width="100%" height="100" preserveAspectRatio="xMidYMid meet">
          <defs>
            <!-- Het pad waarover de cursor loopt. pathLength=100 normaliseert
                 stroke-dash-berekeningen zodat dasharray:100 = volledige lengte. -->
            <path id="io-smart-pad"
              d="M16 78 C 50 78, 60 22, 100 32 S 160 86, 200 50 S 232 24, 232 24"
              fill="none" pathLength="100"/>
          </defs>

          <!-- Achtergrondroute (dashed, lichtgrijs) -->
          <use href="#io-smart-pad"
            stroke="rgba(255,255,255,0.18)" stroke-width="2.5"
            stroke-linecap="round" stroke-dasharray="1.2 2.4"/>

          <!-- Groene gevulde polyline die meeloopt met de cursor -->
          <use href="#io-smart-pad" class="io-smart-fill"
            stroke="#7ab87a" stroke-width="3"
            stroke-linecap="round" stroke-linejoin="round"/>

          <!-- Start- en eindpunt -->
          <circle cx="16" cy="78" r="3.5" fill="#5e9464"/>
          <circle cx="232" cy="24" r="3.5" fill="rgba(255,255,255,0.5)"/>

          <!-- Cursor met GPS-pulsen — beweegt langs het pad -->
          <g class="io-smart-cursor">
            <g class="io-smart-ring-wrap io-smart-ring-1">
              <circle r="8" fill="rgba(122,184,122,0.32)"/>
            </g>
            <g class="io-smart-ring-wrap io-smart-ring-2">
              <circle r="8" fill="rgba(122,184,122,0.22)"/>
            </g>
            <circle r="5" fill="#7ab87a" stroke="#fff" stroke-width="2"/>
            <animateMotion dur="3.6s" repeatCount="indefinite" calcMode="linear">
              <mpath href="#io-smart-pad"/>
            </animateMotion>
          </g>
        </svg>
      </div>

      <div class="io-smart-cards">
        <div class="io-smart-card">
          <div class="io-sc-icoon io-sc-gps">
            <span class="io-sc-dot"></span>
          </div>
          <div class="io-sc-lbl">GPS</div>
          <div class="io-sc-val" style="color:var(--green-lite)">ACTIEF</div>
        </div>
        <div class="io-smart-card">
          <div class="io-sc-icoon">
            <div class="io-bat-body"><div class="io-bat-fill"></div></div>
            <div class="io-bat-cap"></div>
          </div>
          <div class="io-sc-lbl">BATTERIJ</div>
          <div class="io-sc-val" style="color:#f59e0b">GEBRUIK</div>
        </div>
        <div class="io-smart-card">
          <div class="io-sc-icoon io-sc-screen">
            <span class="io-sc-dot io-dot-amber"></span>
          </div>
          <div class="io-sc-lbl">SCHERM</div>
          <div class="io-sc-val" style="color:#f59e0b">AAN</div>
        </div>
      </div>
    </div>`;
}

function _kaartVisual() {
  return `
    <div class="io-kaart-scene">
      <div class="io-kaart-tegel">
        <!-- Stylized mini-map: roads + pins + route -->
        <svg viewBox="0 0 200 140" width="200" height="140" xmlns="http://www.w3.org/2000/svg">
          <!-- Achtergrond tile-pattern -->
          <defs>
            <linearGradient id="ioKaartBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#dee5e3"/>
              <stop offset="100%" stop-color="#c9d3cf"/>
            </linearGradient>
            <linearGradient id="ioKaartBgDark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#2a3850"/>
              <stop offset="100%" stop-color="#1f2a3e"/>
            </linearGradient>
          </defs>
          <rect width="200" height="140" rx="12" fill="url(#ioKaartBg)" class="io-kaart-bg"/>

          <!-- Wegen -->
          <path d="M0 95 Q60 88 110 92 T 200 84" stroke="rgba(255,255,255,0.55)" stroke-width="6" fill="none" stroke-linecap="round"/>
          <path d="M40 0 Q42 40 60 70 T 90 140" stroke="rgba(255,255,255,0.45)" stroke-width="4" fill="none" stroke-linecap="round"/>
          <path d="M120 0 Q132 50 156 80 T 200 130" stroke="rgba(255,255,255,0.35)" stroke-width="3" fill="none" stroke-linecap="round"/>

          <!-- Route polyline met draw-in animatie -->
          <path class="io-kaart-route"
            d="M28 110 Q60 90 95 95 T 175 50"
            stroke="#5e9464" stroke-width="3" fill="none"
            stroke-linecap="round" stroke-dasharray="200" stroke-dashoffset="200"/>

          <!-- Start/Eind pins -->
          <circle cx="28" cy="110" r="6" fill="#4e7d52" stroke="#fff" stroke-width="2"/>
          <circle cx="175" cy="50" r="6" fill="#c94040" stroke="#fff" stroke-width="2"/>

          <!-- Merk-pins (tankstations) — verschijnen na elkaar -->
          <g class="io-kaart-pin" style="animation-delay:0.5s">
            <circle cx="75" cy="60" r="4.5" fill="#DD1D21" stroke="#fff" stroke-width="1.5"/>
          </g>
          <g class="io-kaart-pin" style="animation-delay:0.85s">
            <circle cx="125" cy="105" r="4.5" fill="#006F51" stroke="#fff" stroke-width="1.5"/>
          </g>
          <g class="io-kaart-pin" style="animation-delay:1.2s">
            <circle cx="155" cy="25" r="4.5" fill="#FF6900" stroke="#fff" stroke-width="1.5"/>
          </g>

          <!-- Eigen locatie met accuracy-cirkel + pulse -->
          <g class="io-kaart-locatie" style="transform-origin:60px 95px">
            <circle cx="60" cy="95" r="18" fill="rgba(94,148,100,0.18)" class="io-kaart-acc"/>
            <circle cx="60" cy="95" r="6" fill="#5e9464" stroke="#fff" stroke-width="2.5"/>
          </g>
        </svg>
      </div>
    </div>`;
}

function _kmVisual() {
  return `
    <div class="io-km-scene">
      <span class="io-km-label io-km-top">werkelijk gereden</span>
      <svg viewBox="0 0 240 72" width="240" height="72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="32" y1="36" x2="208" y2="36"
          stroke="rgba(255,255,255,0.12)" stroke-width="2" stroke-dasharray="5 6"/>
        <path class="io-route-line"
          d="M32 36 Q88 4 120 36 Q152 68 208 36"
          stroke="var(--green-lite)" stroke-width="2.5" stroke-linecap="round"
          stroke-dasharray="260" stroke-dashoffset="260"/>
        <circle cx="32" cy="36" r="12" fill="#3d6b47"/>
        <text x="32" y="40.5" text-anchor="middle" fill="white"
          font-size="11" font-family="monospace" font-weight="700">A</text>
        <circle cx="208" cy="36" r="12" fill="#7a2e2e"/>
        <text x="208" y="40.5" text-anchor="middle" fill="white"
          font-size="11" font-family="monospace" font-weight="700">B</text>
      </svg>
      <span class="io-km-label io-km-bottom">kortste route</span>
    </div>`;
}

export class InfoOverlay {
  static _el = null;
  static _onSluit = null;

  static init() {
    this._el = document.getElementById('info-overlay');
    if (!this._el) return;

    document.getElementById('info-overlay-btn').addEventListener('click', () => this.sluit());
    document.getElementById('info-overlay-backdrop').addEventListener('click', () => this.sluit());

    const panel = this._el.querySelector('.io-panel');
    if (panel) Utils.bindSwipeToDismiss(panel, () => this.sluit());
  }

  static toon(type, onSluit = null) {
    const cfg = CONFIGS[type];
    if (!cfg || !this._el) return;

    const chip = document.getElementById('info-overlay-chip');
    chip.textContent = cfg.chip;
    chip.style.color = cfg.chipKleur;
    chip.style.borderColor = cfg.chipKleur + '66';
    chip.style.background = cfg.chipKleur + '1a';

    document.getElementById('info-overlay-titel').textContent = cfg.titel;
    document.getElementById('info-overlay-tekst').textContent = cfg.tekst;
    document.getElementById('info-overlay-btn').textContent = cfg.btn;
    document.getElementById('info-overlay-icoon').innerHTML = cfg.visual();

    this._onSluit = onSluit;
    this._el.classList.remove('hidden');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this._el.classList.add('zichtbaar'));
    });
  }

  static sluit() {
    if (!this._el) return;
    this._el.classList.remove('zichtbaar');
    setTimeout(() => {
      this._el.classList.add('hidden');
      const cb = this._onSluit;
      this._onSluit = null;
      cb?.();
    }, 320);
  }
}
