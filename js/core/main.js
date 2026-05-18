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
    navigator.serviceWorker.register('./sw.js').catch(() => { });
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
