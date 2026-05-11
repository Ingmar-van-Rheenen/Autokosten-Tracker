// ── CarScene ──────────────────────────────────────────────────────────────────
// Gefixeerde body (met onderkant) in de originele groene kleuren.

export class CarScene {

  static mount(el) {
    if (!el) return null;
    el.innerHTML = CarScene._html();
    return el.querySelector('.car-wrapper');
  }

  static _html() {
    return `
      <div class="car-scene">
        <div class="car-wrapper">
          <div class="car-bounce">
            ${CarScene._svgHtml()}
          </div>
        </div>
        <div class="car-road">
          <div class="car-road-dashes"></div>
        </div>
      </div>
    `;
  }

  static _svgHtml() {
    return `
      <svg class="car-svg" viewBox="0 0 200 86" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="100" cy="81" rx="80" ry="5" fill="#000" opacity="0.2"/>

        <path d="
          M 10,55 
          L 10,42 Q 10,38 15,38 
          L 35,38 L 50,15 
          L 145,15 L 165,38 
          L 188,38 Q 195,38 195,45 
          L 195,58 Q 195,62 188,62
          L 172,62 
          A 18,18 0 0 0 132,62 
          L 68,62 
          A 18,18 0 0 0 28,62 
          L 15,62 Q 10,62 10,55 Z" 
          fill="#3d6b47"/>

        <path d="M 54,19 L 95,19 L 95,38 L 44,38 Z" fill="rgba(148,200,218,0.32)"/>
        <path d="M 102,19 L 140,19 L 160,38 L 102,38 Z" fill="rgba(148,200,218,0.32)"/>
        
        <rect x="95" y="16" width="6" height="24" fill="#2a4a34"/> <rect x="10" y="44" width="7" height="12" rx="1" fill="#c94040"/> <path d="M 178,40 Q 192,40 192,48 L 175,48 Z" fill="#d0c888"/> <line x1="98" y1="38" x2="98" y2="62" stroke="#2a4a34" stroke-width="1" opacity="0.5"/>

        ${this._wheelHtml(50, 66)}
        ${this._wheelHtml(152, 66)}
      </svg>
    `;
  }

  static _wheelHtml(cx, cy) {
    return `
      <g transform="translate(${cx},${cy})">
        <g class="car-wheel">
          <circle r="15" fill="#0c1520"/> <circle r="10.5" fill="#1d2d42"/> <g stroke="#3d5878" stroke-width="1.5">
            ${[0, 72, 144, 216, 288].map(r => `<line x1="0" y1="-8" x2="0" y2="-4" transform="rotate(${r})"/>`).join('')}
          </g>
          <circle r="3" fill="#263c58"/>
        </g>
      </g>
    `;
  }
}