// ── Changelog ─────────────────────────────────────────────────────────────────
// Voeg nieuwe entries bovenaan toe. Versie is een oplopend integer.
// De popup verschijnt automatisch als de user een hogere versie nog niet heeft gezien.
import { Utils } from './Utils.js';

const SEEN_KEY = 'tanklog_changelog_seen';

export const VERSIES = [
  {
    versie: 5,
    label: '1.5',
    datum: '7 mei 2026',
    items: [
      'Slimme km-meting: GPS volgt je route continu tijdens de rit',
      'Info-uitleg toegevoegd bij km-aanpassen en tracking-instelling',
      'Changelog: je ziet voortaan wat er nieuw is bij updates',
    ],
  },
  {
    versie: 4,
    label: '1.4',
    datum: '3 mei 2026',
    items: [
      'Tankstations op de kaart — nu met brandstoftype en afstand',
      'Bottom sheet uitklapbaar met maandstats en snelkoppelingen',
      'GPS-ringen en popup-design vernieuwd',
    ],
  },
  {
    versie: 3,
    label: '1.3',
    datum: '15 april 2026',
    items: [
      'Planner: route plannen met tussenstops',
      'Onderhoud bijhouden per auto',
      'Exporteren en importeren van rijgegevens',
    ],
  },
];

export class Changelog {
  static _el = null;

  static init() {
    this._el = document.getElementById('changelog-overlay');
    if (!this._el) return;

    document.getElementById('changelog-backdrop')
      ?.addEventListener('click', () => this._sluit());
    document.getElementById('cl-sluit-btn')
      ?.addEventListener('click', () => this._sluit());

    const card = this._el.querySelector('.changelog-card');
    if (card) Utils.bindSwipeToDismiss(card, () => this._sluit());
  }

  static check() {
    if (!this._el) return;

    const laasteGezien = parseInt(localStorage.getItem(SEEN_KEY) || '0', 10);
    const nieuw = VERSIES.filter((v) => v.versie > laasteGezien);
    if (!nieuw.length) return;

    this._render(nieuw);

    // Kleine vertraging zodat de app eerst laadt
    setTimeout(() => {
      this._el.classList.remove('hidden');
      requestAnimationFrame(() =>
        requestAnimationFrame(() => this._el.classList.add('zichtbaar'))
      );
    }, 900);
  }

  static _render(entries) {
    const eerste = entries[0];

    document.getElementById('cl-versie').textContent = `v${eerste.label}`;
    document.getElementById('cl-datum').textContent = eerste.datum;

    const lijst = document.getElementById('cl-lijst');
    lijst.innerHTML = entries
      .flatMap((e, i) =>
        i === 0
          ? e.items.map((t) => `<li>${t}</li>`)
          : [
              `<li class="cl-sectie-kop">v${e.label} · ${e.datum}</li>`,
              ...e.items.map((t) => `<li class="cl-oud">${t}</li>`),
            ]
      )
      .join('');
  }

  static _sluit() {
    if (!this._el) return;
    this._el.classList.remove('zichtbaar');
    setTimeout(() => {
      this._el.classList.add('hidden');
      // Markeer nieuwste versie als gezien
      localStorage.setItem(SEEN_KEY, String(VERSIES[0].versie));
    }, 300);
  }
}
