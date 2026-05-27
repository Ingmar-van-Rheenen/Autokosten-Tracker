# Vroom — CLAUDE.md

## Project

**Vroom** (voorheen Tanklog) is a mobile-first PWA for tracking car trips, fuel refills, and costs. Originally built for personal use (tracking usage of a parent's car), now evolving into a multi-user app backed by `vroom-api` (zie repo `Ingmar-van-Rheenen/vroom-api`).

## Stack

- **HTML / CSS / Vanilla JS** — ES modules, no framework, no bundler
- **Leaflet 1.9.4** — map rendering (loaded via CDN)
- **OSRM** — public routing API for distance calculation (no API key)
- **localStorage** — primary data store today (`vroom_v1`, migrates from `tanklog_v3`/`v2`/`autokosten_v1`); the Vroom API is being introduced as the authoritative source in upcoming sprints
- **Service Worker** — PWA offline support (`sw.js`)

## Architecture

```
index.html          Single-page app, three screens: splash → auto-select → main app
manifest.json       PWA manifest
sw.js               Service worker (caching)
style.css           All styles (no preprocessor)
js/
  main.js           Entry point — instantiates App and calls init()
  App.js            Orchestrator: screen transitions, tab navigation, PWA install
  Database.js       localStorage CRUD — key: vroom_v1, migrates from tanklog_v3/v2/autokosten_v1
  GeoService.js     GPS / geolocation wrapper
  MapController.js  Leaflet map init, markers, route polyline
  RitController.js  Start/stop trip flow, OSRM API call, save trip
  RittenController.js  Render trip list
  TankController.js Fuel entry form + list render
  StatsController.js  Saldo and overview stats
  AutoManager.js    Multi-car management (add, select)
  DataManager.js    Export/import/reset JSON data
  Utils.js          uid(), wacht(), currency/date formatters
```

## Data model (localStorage key: `vroom_v1`)

```json
{
  "naam": "Ingmar",
  "autos": [{ "id": "uuid", "naam": "Auto van Mama", "merk": "Volkswagen Polo", "km_per_liter": 14, "prijs_per_liter": 2.10, "emoji": "🚗" }],
  "geselecteerd": "uuid",
  "ritten": [{ "id": "uuid", "datum": "ISO8601", "start": { "lat": 0, "lng": 0 }, "eind": { "lat": 0, "lng": 0 }, "km": 47.3, "auto_id": "uuid" }],
  "tankbeurten": [{ "id": "uuid", "datum": "ISO8601", "liters": 20, "prijs_per_liter": 2.08, "totaal": 41.60, "auto_id": "uuid" }]
}
```

## Balance calculation

```
verschuldigd = sum(ritten km) / km_per_liter × prijs_per_liter
tegoed       = sum(tankbeurten totaal)
saldo        = tegoed − verschuldigd
```

Positive saldo = user overpaid (credit). Negative = still owes money.

## Key conventions

- All code and comments are in **Dutch** (variable names, UI text, method names)
- No build step — edit files and reload in browser
- No TypeScript — plain JS with JSDoc-style structure where helpful
- `Utils.uid()` for generating IDs, `Utils.wacht(ms)` for delays
- Controllers receive `db` and an `onUpdate` callback; they call the callback after mutations so `App` can refresh stats
- Global functions (`exportData`, `importData`, `resetData`) are attached to `window` in `App.js` for HTML `onclick` attributes

## Development

Open `index.html` directly in a browser or via a local server. No install or build needed.

For GPS to work, serve over HTTPS or `localhost` (browser requirement).

## Deployment

Static files — production deploy gaat via FTP naar aaPanel op
`auto.ingmarvanrheenen.nl`.

**Eerste setup:**

```bash
cp .env.deploy.example .env.deploy
# Vul FTP_USER, FTP_PASS, FTP_REMOTE_DIR in
chmod +x deploy.sh
```

**Deploy:**

```bash
./deploy.sh
```

Het script uploadt alleen tracked git files (`git ls-files`), skipt
deploy-tooling (CLAUDE.md, deploy.sh, .env.deploy.example, .claude/,
design/). Credentials staan in `.env.deploy` dat gitignored is.

Voor andere hosts kan deze app ook 1-op-1 op GitHub Pages, Netlify of
Vercel — geen build step nodig.
