// ── Service Worker — Tanklog PWA ──────────────────────────────────────────────
const CACHE = 'tanklog-v39';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/tokens.css',
  '/css/animations.css',
  '/css/screens.css',
  '/css/car-scene.css',
  '/css/splash.css',
  '/css/intro.css',
  '/css/auto-select.css',
  '/css/app-layout.css',
  '/css/kaart-tab.css',
  '/css/content-tabs.css',
  '/css/forms.css',
  '/css/items.css',
  '/css/modal.css',
  '/css/pwa.css',
  '/css/planner.css',
  '/css/grafieken.css',
  '/css/shortcut.css',
  '/css/info-overlay.css',
  '/css/changelog.css',
  '/css/controls.css',
  '/css/print.css',
  '/js/main.js',
  '/js/CarScene.js',
  '/js/App.js',
  '/js/Utils.js',
  '/js/Database.js',
  '/js/GeoService.js',
  '/js/MapController.js',
  '/js/RitController.js',
  '/js/RittenController.js',
  '/js/TankController.js',
  '/js/PrijsService.js',
  '/js/StatsController.js',
  '/js/AutoManager.js',
  '/js/DataManager.js',
  '/js/OnderhoudController.js',
  '/js/PlannerController.js',
  '/js/DeelController.js',
  '/js/BottomSheetController.js',
  '/js/InfoOverlay.js',
  '/js/Changelog.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=DM+Sans:wght@400;500;600&display=swap',
];

// ── Installatie: pre-cache alle app-bestanden ─────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => { }))
  );
  self.skipWaiting();
});

// ── Activatie: verwijder oude cache-versies ────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first voor app-bestanden, network-only voor live API's ────────
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const live = (
    url.hostname.includes('osrm') ||
    url.hostname.includes('openstreetmap') ||
    url.hostname.includes('nominatim') ||
    url.hostname.includes('carto') ||
    url.hostname.includes('overpass-api') ||
    url.hostname.includes('opendata.cbs')
  );

  if (live) {
    // Live API's: altijd via netwerk, fallback naar 503
    e.respondWith(
      fetch(e.request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // App-bestanden: cache-first, dan netwerk
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
