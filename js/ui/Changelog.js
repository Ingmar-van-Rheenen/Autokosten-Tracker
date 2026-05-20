// ── Changelog ─────────────────────────────────────────────────────────────────
// Voeg nieuwe entries bovenaan toe. Versie is een oplopend integer.
// De popup verschijnt automatisch als de user een hogere versie nog niet heeft gezien.
import { Utils } from '../core/Utils.js';

const SEEN_KEY = 'tanklog_changelog_seen';

export const VERSIES = [
  {
    versie: 8,
    label: '3.2',
    datum: '2026-05-20',
    items: [
      'Rit-detail: tik een rit aan voor de gereden route op de kaart + statistieken',
      'Maand-recap: terugblik op de vorige maand met cijfers, top-bestemmingen en verbruik',
      'Notificaties: krijg een melding als APK / verzekering bijna afloopt',
      'Notificaties: melding zodra het saldo onder je drempel duikt',
      'Update-banner: nieuwe versies installeren zonder rare half-oude state',
      'Offline-indicator onderaan zodra het netwerk wegvalt',
      'Systeem-sectie in instellingen: app-versie, opslag en kaart-cache wissen',
      'Tanklog als share-target: deel een locatie vanuit Maps direct naar een nieuwe rit',
      'Vaste data wordt nu persistent gemaakt zodat de browser hem niet evict',
    ],
  },
  {
    versie: 7,
    label: '3.1',
    datum: '2026-05-12',
    items: [
      'Kaart v2: tiles wisselen mee met thema (licht/donker)',
      'Locate-me knop rechtsboven op de kaart',
      'Eigen locatie-marker met accuracy-cirkel en heading-pijl',
      'Route tekent zich vloeiend in na een rit-suggestie',
      'Tankstations krijgen hun eigen merk-kleur (Shell, BP, Esso, …)',
      'Tankstations clusteren bij uitgezoomd zicht',
      'Track tijdens rit kleurt mee met je snelheid',
      'Kaart-tiles werken offline (recent bezochte gebieden)',
      'Optioneel: Stadia Maps API-key voor mooiere tiles',
      'Klassiek-thema vervangt Automatisch — originele v2-look',
    ],
  },
  {
    versie: 6,
    label: '3.0',
    datum: '2026-05-11',
    items: [
      'Donkere modus + lichte modus (auto/licht/donker)',
      'Vaste kosten (verzekering, wegenbelasting, apk, parkeren)',
      'Betalingen-geschiedenis tussen jou en je auto-deler',
      'Live route op de kaart tijdens een rit + elapsed-tijd',
      'Km-stand bij rit en tankbeurt',
      'Bon-foto opslaan bij een tankbeurt',
      'Afrekenen-sheet met WhatsApp + Tikkie + bunq + Revolut',
      'Periode-filter op stats (maand / jaar / alles)',
      'Swipe-naar-links om te verwijderen met undo',
    ],
  },
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
