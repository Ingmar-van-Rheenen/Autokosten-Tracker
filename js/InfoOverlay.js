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
};

function _smartVisual() {
  return `
    <div class="io-smart-scene">
      <div class="io-gps-wrap">
        <div class="io-gps-ring" style="animation-delay:0s"></div>
        <div class="io-gps-ring" style="animation-delay:0.85s"></div>
        <div class="io-gps-ring" style="animation-delay:1.7s"></div>
        <div class="io-gps-center">
          <svg viewBox="0 0 24 28" width="20" height="23" fill="currentColor">
            <path d="M12 0C7.58 0 4 3.58 4 8c0 6 8 18 8 18s8-12 8-18c0-4.42-3.58-8-8-8zm0 11.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 4.5 12 4.5s3.5 1.57 3.5 3.5S13.93 11.5 12 11.5z"/>
          </svg>
        </div>
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
