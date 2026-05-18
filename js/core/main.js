// ── main.js ───────────────────────────────────────────────────────────────────
// Entrypoint: splash is inline in index.html zodat hij direct zichtbaar is.
// We mounten eerst de splash-scenes, daarna fetchen we de partials (met
// voortgang in de splash-loader), en pas dan start App.init().
import { App } from './App.js';
import { Partials } from './Partials.js';
import { CarScene } from '../scenes/CarScene.js';
import { SplashScene } from '../scenes/SplashScene.js';

window.addEventListener('DOMContentLoaded', async () => {
  // SW registratie zonder auto-reload — eerder veroorzaakte
  // controllerchange + Partials._herstel een reload-loop wanneer Live
  // Server elke install als 'new SW' zag. De gebruiker reload zelf na
  // een deploy; Partials.js detecteert stale-cache issues alsnog.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
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
