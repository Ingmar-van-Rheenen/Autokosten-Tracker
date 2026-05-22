// ── InstallManager ────────────────────────────────────────────────────────────
// PWA install-prompt logica: detecteert of de app al geïnstalleerd is,
// toont de install-overlay op mobiel, en begeleidt de installatiesstappen.

export class InstallManager {
  /** Controleer of de install-overlay getoond moet worden. Blokkeert tot dismiss. */
  check() {
    const DISMISS_KEY = 'pwa_banner_dismissed';
    const DISMISS_DUUR = 7 * 24 * 60 * 60 * 1000;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      navigator.standalone === true;
    if (isStandalone) return Promise.resolve();

    let dismissedOp;
    try { dismissedOp = localStorage.getItem(DISMISS_KEY); } catch {}
    if (dismissedOp && Date.now() - parseInt(dismissedOp, 10) < DISMISS_DUUR) return Promise.resolve();

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
    const isMobiel = /android|iphone|ipad|ipod|mobile/i.test(ua) || window.innerWidth < 768;
    if (!isMobiel) return Promise.resolve();

    const overlay = document.getElementById('install-overlay');
    if (!overlay) return Promise.resolve();

    return new Promise((resolve) => {
      const sluit = () => {
        overlay.classList.add('hidden');
        resolve();
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
      };

      document.getElementById('install-sluit')?.addEventListener('click', sluit, { once: true });
      document.getElementById('install-later')?.addEventListener('click', sluit, { once: true });
      document.getElementById('install-overlay-bd')?.addEventListener('click', sluit, { once: true });
      window.addEventListener('appinstalled', sluit, { once: true });

      let deferredPrompt = null;
      if (!isIos) {
        window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault();
          deferredPrompt = e;
        }, { once: true });
      }

      document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
          sluit();
          return;
        }
        this._toonStappen(isIos ? 'ios' : 'android');
        sluit();
      }, { once: true });

      overlay.classList.remove('hidden');
    });
  }

  /** Toon de install-stappen overlay met platform-tabs (iOS / Android). */
  _toonStappen(actiefPlatform = 'ios') {
    const overlay = document.getElementById('install-stappen-overlay');
    if (!overlay) return;

    const wisselPlatform = (platform) => {
      overlay.querySelectorAll('.install-platform-tab').forEach((tab) => {
        const aan = tab.dataset.platform === platform;
        tab.classList.toggle('actief', aan);
        tab.setAttribute('aria-selected', aan ? 'true' : 'false');
      });
      overlay.querySelectorAll('.install-stappen-paneel').forEach((p) => {
        p.classList.toggle('hidden', p.dataset.paneel !== platform);
      });
    };
    wisselPlatform(actiefPlatform);

    overlay.querySelectorAll('.install-platform-tab').forEach((tab) => {
      tab.addEventListener('click', () => wisselPlatform(tab.dataset.platform));
    });

    const sluit = () => {
      overlay.classList.remove('zichtbaar');
      setTimeout(() => overlay.classList.add('hidden'), 320);
    };
    document.getElementById('install-stappen-sluit')?.addEventListener('click', sluit, { once: true });
    document.getElementById('install-stappen-backdrop')?.addEventListener('click', sluit, { once: true });

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('zichtbaar'));
    });
  }
}
