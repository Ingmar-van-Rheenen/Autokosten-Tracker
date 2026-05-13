// ── main.js ───────────────────────────────────────────────────────────────────
// Entrypoint: wacht op volledige DOM-laad en start de App.
import { App } from './App.js';
import { CarScene } from './CarScene.js';
import { SplashScene } from './SplashScene.js';

window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }

  // Build de time-of-day splash scene (lucht, hemellichaam, decoraties, groet)
  SplashScene.mount();

  // Mount het rijdende-auto component in beide slots
  CarScene.mount(document.getElementById('splash-car-scene'));
  CarScene.mount(document.getElementById('intro-car-scene'));

  new App().init();
});
