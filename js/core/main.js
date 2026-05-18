// ── main.js ───────────────────────────────────────────────────────────────────
// Entrypoint: wacht op DOM-laad, injecteer HTML-partials, start de App.
import { App } from './App.js';
import { Partials } from './Partials.js';
import { CarScene } from '../scenes/CarScene.js';
import { SplashScene } from '../scenes/SplashScene.js';

window.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }

  // index.html bevat alleen <div data-partial="..."> placeholders.
  // Eerst de fragmenten ophalen + injecteren zodat alle id's bestaan,
  // pas daarna scenes mounten en App starten.
  await Partials.load();

  SplashScene.mount();
  CarScene.mount(document.getElementById('splash-car-scene'));
  CarScene.mount(document.getElementById('intro-car-scene'));

  new App().init();
});
