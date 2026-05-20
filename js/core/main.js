// ── main.js ───────────────────────────────────────────────────────────────────
// Entrypoint: splash is inline in index.html zodat hij direct zichtbaar is.
// We mounten eerst de splash-scenes, daarna fetchen we de partials (met
// voortgang in de splash-loader), en pas dan start App.init().
import { App } from './App.js';
import { Partials } from './Partials.js';
import { CarScene } from '../scenes/CarScene.js';
import { SplashScene } from '../scenes/SplashScene.js';
import { SwUpdate } from '../ui/SwUpdate.js';

// Detecteer development-mode: localhost / 127.0.0.1 / 0.0.0.0 / file:// →
// geen Service Worker registreren + eventuele oude SW + caches opruimen.
// location.hostname bevat GEEN poortnummer, dus check alleen op host.
const IS_DEV =
  ['localhost', '127.0.0.1', '0.0.0.0'].includes(location.hostname) ||
  location.protocol === 'file:';

window.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    if (IS_DEV) {
      // Dev: unregister bestaande SW + wis caches zodat we altijd verse
      // bestanden krijgen.
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {}
    } else {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => SwUpdate.init(reg))
        .catch(() => { /* SW-registratie kan in private mode falen */ });
    }
  }

  // Splash is direct zichtbaar — vul de hemel + auto-animatie meteen
  // zodat er geen statisch silhouet staat tijdens het partial-fetchen.
  SplashScene.mount();
  CarScene.mount(document.getElementById('splash-car-scene'));

  // Fetch + injecteer alle partials; update de splash-loader tekst.
  await Partials.load();

  // Intro-scene zit in een partial, dus pas nu beschikbaar.
  CarScene.mount(document.getElementById('intro-car-scene'));

  new App().init();
});
