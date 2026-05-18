// ── Service Worker — Tanklog PWA ──────────────────────────────────────────────
const CACHE = 'tanklog-v50';
const TILE_CACHE = 'tanklog-tiles-v1';
const TILE_CACHE_MAX = 400; // ~50MB met 128KB tiles
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/base/tokens.css',
  '/css/base/print.css',
  '/css/screens/screens.css',
  '/css/screens/splash.css',
  '/css/screens/intro.css',
  '/css/screens/auto-select.css',
  '/css/screens/app-layout.css',
  '/css/tabs/kaart-tab.css',
  '/css/tabs/content-tabs.css',
  '/css/tabs/items.css',
  '/css/tabs/grafieken.css',
  '/css/tabs/planner.css',
  '/css/components/animations.css',
  '/css/components/car-scene.css',
  '/css/components/forms.css',
  '/css/components/modal.css',
  '/css/components/confirm-modal.css',
  '/css/components/info-overlay.css',
  '/css/components/changelog.css',
  '/css/components/swipe.css',
  '/css/components/controls.css',
  '/css/components/shortcut.css',
  '/css/components/pwa.css',
  '/css/features/vaste-kosten.css',
  '/css/features/betalingen.css',
  '/css/features/afreken.css',
  '/css/desktop/layout.css',
  '/css/desktop/widgets/saldo.css',
  '/css/desktop/widgets/trend.css',
  '/css/desktop/widgets/mini-lijst.css',
  '/css/desktop/widgets/vaste-kosten.css',
  '/css/desktop/widgets/stats.css',
  '/css/desktop/widgets/kaart.css',
  '/css/desktop/widgets/quick-actions.css',
  '/css/desktop/widgets/thema.css',
  '/js/core/main.js',
  '/js/core/App.js',
  '/js/core/Utils.js',
  '/js/core/Database.js',
  '/js/services/GeoService.js',
  '/js/services/MapController.js',
  '/js/services/PrijsService.js',
  '/js/controllers/RitController.js',
  '/js/controllers/RittenController.js',
  '/js/controllers/TankController.js',
  '/js/controllers/StatsController.js',
  '/js/controllers/AutoManager.js',
  '/js/controllers/DataManager.js',
  '/js/controllers/OnderhoudController.js',
  '/js/controllers/PlannerController.js',
  '/js/controllers/DeelController.js',
  '/js/controllers/BottomSheetController.js',
  '/js/controllers/VasteKostenController.js',
  '/js/controllers/BetalingenController.js',
  '/js/controllers/AfrekenController.js',
  '/js/ui/InfoOverlay.js',
  '/js/ui/Changelog.js',
  '/js/ui/ThemaController.js',
  '/js/ui/ConfirmModal.js',
  '/js/scenes/CarScene.js',
  '/js/scenes/SplashScene.js',
  '/js/desktop/DesktopDashboard.js',
  '/js/desktop/widgets/SaldoWidget.js',
  '/js/desktop/widgets/TrendWidget.js',
  '/js/desktop/widgets/RittenWidget.js',
  '/js/desktop/widgets/TankWidget.js',
  '/js/desktop/widgets/VasteKostenWidget.js',
  '/js/desktop/widgets/StatsWidget.js',
  '/js/desktop/widgets/KaartWidget.js',
  '/js/desktop/widgets/QuickActionsWidget.js',
  '/js/desktop/widgets/ThemaWidget.js',
  '/css/features/sync.css',
  '/js/controllers/SyncController.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
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
      Promise.all(
        keys
          .filter((k) => k !== CACHE && k !== TILE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Tile cache LRU-pruning ────────────────────────────────────────────────────
async function pruneTileCache() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= TILE_CACHE_MAX) return;
  // Oudste-eerst: keys() geeft insertion-order terug, dus pak de eerste N weg
  const overschot = keys.length - TILE_CACHE_MAX;
  for (let i = 0; i < overschot; i++) {
    await cache.delete(keys[i]);
  }
}

// ── Fetch: cache-first voor app-bestanden, network-only voor live API's ────────
self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Alleen GET-requests onderscheppen. Andere methodes laten we doorlopen.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ── Map tiles (CartoCDN + Stadia) → stale-while-revalidate ─────────
  // We cachen recent bezochte tiles (max ~50MB LRU). Bij offline: hit uit cache.
  if (url.hostname.includes('basemaps.cartocdn.com') ||
      url.hostname.includes('tiles.stadiamaps.com')) {
    e.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const netwerk = fetch(req).then((resp) => {
          if (resp && (resp.status === 200 || resp.type === 'opaque')) {
            cache.put(req, resp.clone())
              .then(() => pruneTileCache())
              .catch(() => { });
          }
          return resp;
        }).catch(() => null);
        return cached || netwerk || new Response('', { status: 503 });
      })
    );
    return;
  }

  const live = (
    url.hostname.includes('osrm') ||
    url.hostname.includes('openstreetmap') ||
    url.hostname.includes('nominatim') ||
    url.hostname.includes('overpass-api') ||
    url.hostname.includes('opendata.cbs')
  );

  if (live) {
    // Live API's: altijd via netwerk, fallback naar 503
    e.respondWith(
      fetch(req).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // Cross-origin fonts (fonts.gstatic.com) — opaque responses, cache-first.
  // Belangrijk: niet via cache.match() halen want de woff2-files staan
  // niet in onze precache; doe stale-while-revalidate met no-cors.
  if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const netwerk = fetch(req).then((resp) => {
            if (resp && (resp.status === 200 || resp.type === 'opaque')) {
              cache.put(req, resp.clone()).catch(() => { });
            }
            return resp;
          }).catch(() => null);
          return cached || netwerk || fetch(req);
        })
      ).catch(() => fetch(req))
    );
    return;
  }

  // App-bestanden (same-origin + leaflet CDN): cache-first, dan netwerk.
  // Fallback naar netwerk-only als zowel cache als fetch falen — geen reject
  // die de browser als "ServiceWorker error" toont.
  e.respondWith(
    caches.match(req)
      .then((cached) => cached || fetch(req))
      .catch(() => fetch(req).catch(() => new Response('', { status: 503 })))
  );
});
