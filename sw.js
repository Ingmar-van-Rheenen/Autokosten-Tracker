// ── Service Worker — Tanklog PWA ──────────────────────────────────────────────
const CACHE = 'tanklog-v80';
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
  '/css/components/sw-update.css',
  '/css/features/vaste-kosten.css',
  '/css/features/betalingen.css',
  '/css/features/afreken.css',
  '/css/features/rit-detail.css',
  '/css/features/maand-recap.css',
  '/css/features/systeem.css',
  '/css/features/qol.css',
  '/css/desktop/layout.css',
  '/css/desktop/modals.css',
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
  '/js/core/Partials.js',
  '/partials/intro.partial',
  '/partials/auto-select.partial',
  '/partials/bottom-nav.partial',
  '/partials/app/kaart-tab.partial',
  '/partials/app/ritten-tab.partial',
  '/partials/app/saldo-tab.partial',
  '/partials/app/overzicht-tab.partial',
  '/partials/app/instellingen-tab.partial',
  '/partials/desktop/dashboard.partial',
  '/partials/desktop/modals.partial',
  '/partials/overlays/changelog.partial',
  '/partials/overlays/info.partial',
  '/partials/overlays/rit-detail.partial',
  '/partials/overlays/maand-recap.partial',
  '/partials/overlays/install.partial',
  '/partials/modals/auto-toevoegen.partial',
  '/partials/modals/auto-wisselen.partial',
  '/partials/modals/rit-bewerken.partial',
  '/partials/modals/rit-splitsen.partial',
  '/partials/modals/bevestigen.partial',
  '/partials/modals/afrekenen.partial',
  '/partials/modals/install-stappen.partial',
  '/partials/sheets/vaste-kost.partial',
  '/js/services/GeoService.js',
  '/js/services/MapController.js',
  '/js/services/PrijsService.js',
  '/js/controllers/RitController.js',
  '/js/controllers/RittenController.js',
  '/js/controllers/RitDetailController.js',
  '/js/controllers/MaandRecapController.js',
  '/js/controllers/TrashController.js',
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
  '/js/ui/SwUpdate.js',
  '/js/ui/StorageInfo.js',
  '/js/ui/NotificatieController.js',
  '/js/scenes/CarScene.js',
  '/js/scenes/SplashScene.js',
  '/js/desktop/DesktopDashboard.js',
  '/js/desktop/DesktopModals.js',
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
  'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  // Google Fonts CSS bewust NIET in precache — laat de browser cachen.
];

// ── Installatie: pre-cache alle app-bestanden ─────────────────────────────────
// We roepen NIET zelf skipWaiting() aan. Een nieuwe SW blijft "waiting" tot de
// pagina via postMessage {type:'SKIP_WAITING'} opdracht geeft — dan zit de
// gebruiker niet midden in een sessie met half-oude / half-nieuwe assets.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => { }))
  );
});

// Communicatiekanaal SW ↔ page voor versie-info, cache-wissen en SW-overname.
// MessageChannel-port (in event.ports[0]) wordt gebruikt zodat de page een
// directe response krijgt — geen broadcast naar alle clients.
self.addEventListener('message', (e) => {
  const type = e.data && e.data.type;
  const reply = (msg) => {
    const port = e.ports && e.ports[0];
    if (port) port.postMessage(msg);
    else if (e.source && e.source.postMessage) e.source.postMessage(msg);
  };

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (type === 'GET_VERSION') {
    reply({ type: 'VERSION', version: CACHE });
    return;
  }

  if (type === 'CLEAR_TILE_CACHE') {
    e.waitUntil(
      caches.delete(TILE_CACHE)
        .then(() => reply({ type: 'TILE_CACHE_CLEARED', ok: true }))
        .catch(() => reply({ type: 'TILE_CACHE_CLEARED', ok: false }))
    );
  }
});

// ── Notificatie-klik: focus bestaande tab of open nieuwe ─────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const open = clients.find((c) => 'focus' in c);
        if (open) {
          if (url && url !== '/' && open.navigate) {
            open.navigate(url).catch(() => { });
          }
          return open.focus();
        }
        return self.clients.openWindow(url);
      })
  );
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

  // Google Fonts (fonts.gstatic.com + fonts.googleapis.com) NIET intercepten —
  // de browser's HTTP-cache + `font-display: swap` fallback regelen het beter.
  // Eerdere SW-handlers cachten opaque-responses die soms terugkwamen als 503
  // ('OTS parsing error') waardoor de fonts visueel kapot bleven; door hier
  // niet `e.respondWith` aan te roepen gaat het request direct naar het netwerk.
  if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
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
