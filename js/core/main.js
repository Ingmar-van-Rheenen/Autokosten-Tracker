// ── main.js ───────────────────────────────────────────────────────────────────
// Entrypoint: splash is inline in index.html zodat hij direct zichtbaar is.
// We mounten eerst de splash-scenes, daarna fetchen we de partials (met
// voortgang in de splash-loader), en pas dan start App.init().
import { App } from './App.js';
import { Partials } from './Partials.js';
import { CarScene } from '../scenes/CarScene.js';
import { SplashScene } from '../scenes/SplashScene.js';

window.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      // Wanneer een nieuwe SW klaar staat (na recente deploy met nieuwe
      // assets) → activeren + reloaden zodat alle precaches kloppen.
      reg.addEventListener('updatefound', () => {
        const nieuw = reg.installing;
        nieuw?.addEventListener('statechange', () => {
          if (nieuw.state === 'installed' && navigator.serviceWorker.controller) {
            // Tweede install (er was al een SW actief) → forceer activatie.
            nieuw.postMessage?.({ type: 'SKIP_WAITING' });
          }
        });
      });
      // Reload exact eenmaal wanneer een nieuwe SW de controle pakt.
      let bezigMetReload = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (bezigMetReload) return;
        bezigMetReload = true;
        location.reload();
      });
    } catch { /* SW registratie mislukt — app werkt nog steeds */ }
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
