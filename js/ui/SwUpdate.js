// ── SwUpdate ──────────────────────────────────────────────────────────────────
// Detecteert nieuwe service-worker versies en presenteert een "Vernieuwen"-
// banner aan de gebruiker. Zonder dit module activeert een nieuwe SW direct,
// terwijl de pagina nog op de oude (in-memory) JS draait — dat geeft de
// klassieke "ik heb herladen maar zie de update niet"-bug.
//
// Vereist: sw.js luistert naar postMessage {type:'SKIP_WAITING'}.

const CONTROLE_INTERVAL_MS = 15 * 60 * 1000; // 15 min

export const SwUpdate = {
  /**
   * @param {ServiceWorkerRegistration} reg
   */
  init(reg) {
    if (!reg) return;

    // 1) Toon banner als er al een waiting-SW staat bij paginalaad.
    if (reg.waiting && navigator.serviceWorker.controller) {
      toonBanner(reg.waiting);
    }

    // 2) Luister naar nieuwe SW-installaties.
    reg.addEventListener('updatefound', () => {
      const nieuw = reg.installing;
      if (!nieuw) return;
      nieuw.addEventListener('statechange', () => {
        // Nieuwe SW is binnen + er is een oude in control → update beschikbaar.
        if (nieuw.state === 'installed' && navigator.serviceWorker.controller) {
          toonBanner(nieuw);
        }
      });
    });

    // 3) Pagina-reload zodra de nieuwe SW het overneemt (na SKIP_WAITING).
    let herlaad = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (herlaad) return;
      herlaad = true;
      window.location.reload();
    });

    // 4) Periodieke check (en bij pagina-focus) — anders moet de gebruiker
    //    de tab herladen om te weten of er een update is.
    const check = () => reg.update().catch(() => { /* offline / netwerk-fout */ });
    setInterval(check, CONTROLE_INTERVAL_MS);
    window.addEventListener('focus', check);

    // 5) Offline-indicator (kleine pill onderaan zodra het netwerk wegvalt).
    bindOnline();
  },
};

// ── Banner ───────────────────────────────────────────────────────────────────

/** Toon de "Nieuwe versie beschikbaar"-banner (één keer per sessie). */
function toonBanner(wachtende) {
  if (document.getElementById('sw-update-banner')) return;

  const el = document.createElement('div');
  el.id = 'sw-update-banner';
  el.className = 'sw-update-banner';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="sw-update-tekst">
      <span class="sw-update-titel">Nieuwe versie beschikbaar</span>
      <span class="sw-update-sub">Vernieuw om de updates te laden.</span>
    </div>
    <button type="button" class="sw-update-knop">Vernieuwen</button>
    <button type="button" class="sw-update-sluit" aria-label="Later">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  `;

  el.querySelector('.sw-update-knop').addEventListener('click', () => {
    el.classList.add('uit');
    // SW reageert op deze message → skipWaiting → controllerchange → reload.
    wachtende.postMessage({ type: 'SKIP_WAITING' });
  });
  el.querySelector('.sw-update-sluit').addEventListener('click', () => {
    el.classList.add('uit');
    setTimeout(() => el.remove(), 320);
  });

  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() =>
    el.classList.add('zichtbaar')
  ));
}

// ── Offline-indicator ────────────────────────────────────────────────────────

function bindOnline() {
  if (window._swOnlineGebonden) return;
  window._swOnlineGebonden = true;

  const update = () => {
    if (navigator.onLine) {
      document.getElementById('sw-offline-pil')?.remove();
      return;
    }
    if (document.getElementById('sw-offline-pil')) return;
    const pil = document.createElement('div');
    pil.id = 'sw-offline-pil';
    pil.className = 'sw-offline-pil';
    pil.innerHTML = `
      <span class="sw-offline-dot" aria-hidden="true"></span>
      <span>Offline — wijzigingen blijven op dit apparaat</span>
    `;
    document.body.appendChild(pil);
    requestAnimationFrame(() => requestAnimationFrame(() =>
      pil.classList.add('zichtbaar')
    ));
  };

  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

export default SwUpdate;
