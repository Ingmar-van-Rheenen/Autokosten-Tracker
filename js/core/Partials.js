// ── Partials ──────────────────────────────────────────────────────────────────
// Laadt HTML-fragmenten uit /partials/ en vervangt elk
// `<div data-partial="path"></div>` placeholder met de inhoud van het
// bijbehorende bestand. Wordt eenmaal aangeroepen voor App.init() zodat
// elke `document.getElementById(...)` aanwezig is.
//
// Een stale Service Worker kan een 200 OK terug geven met de verkeerde
// inhoud (bv. de SPA-fallback index.html voor een onbekende partial-URL).
// Daarom valideren we na injectie of de bekend-vereiste id's bestaan;
// zo niet → SW unregistreren + caches wissen + hard reload.

// Sentinel-id's per partial — als deze ontbreken na injectie weten we
// dat de inhoud foutief was, ongeacht HTTP-status.
const VERPLICHTE_IDS = {
  'intro': 'screen-intro',
  'auto-select': 'screen-auto',
  'bottom-nav': null, // alleen klassen, geen id-check
  'app/kaart-tab': 'btn-start',
  'app/ritten-tab': 'tab-ritten',
  'app/saldo-tab': 'tab-saldo',
  'app/overzicht-tab': 'tab-overzicht',
  'app/instellingen-tab': 'tab-instellingen',
  'desktop/dashboard': 'desktop-dashboard',
  'overlays/changelog': 'changelog-overlay',
  'overlays/info': 'info-overlay',
  'overlays/install': 'install-overlay',
  'modals/auto-toevoegen': 'modal-auto',
  'modals/auto-wisselen': 'modal-auto-wissel',
  'modals/rit-bewerken': 'modal-rit',
  'modals/rit-splitsen': 'modal-deel',
  'modals/bevestigen': 'modal-confirm',
  'modals/afrekenen': 'modal-afreken',
  'sheets/vaste-kost': 'sheet-vaste-kost',
};

export class Partials {
  static async load() {
    const mounts = Array.from(document.querySelectorAll('[data-partial]'));
    if (!mounts.length) return;

    const loaderEl = document.querySelector('.splash-loader-text');
    const totaal = mounts.length;
    let klaar = 0;
    const setStatus = (tekst) => { if (loaderEl) loaderEl.textContent = tekst; };
    setStatus(`BESTANDEN LADEN… 0/${totaal}`);

    const ingeladen = await Promise.all(mounts.map(async (mount) => {
      const naam = mount.getAttribute('data-partial');
      if (!naam) return { mount, html: null, naam };
      try {
        // Cache-busting query string voorkomt dat een buggy SW de
        // verkeerde response uit zijn cache serveert.
        const res = await fetch(`partials/${naam}.html?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        if (!html || !html.trim()) throw new Error('leeg antwoord');
        // Detecteer een SPA-fallback (SW returnde index.html ipv partial).
        if (/<!DOCTYPE\s+html/i.test(html) || /<html[\s>]/i.test(html)) {
          throw new Error('kreeg HTML-document ipv partial');
        }
        klaar++;
        setStatus(`BESTANDEN LADEN… ${klaar}/${totaal}`);
        return { mount, html, naam };
      } catch (e) {
        klaar++;
        console.error(`[Partials] partials/${naam}.html niet geladen:`, e);
        setStatus(`BESTANDEN LADEN… ${klaar}/${totaal}`);
        return { mount, html: null, naam };
      }
    }));

    const mislukt = ingeladen.filter((x) => x.html === null);
    if (mislukt.length) {
      await Partials._herstel(`${mislukt.length} bestanden niet geladen`, setStatus);
      throw new Error(`Partials niet geladen: ${mislukt.map((m) => m.naam).join(', ')}`);
    }

    setStatus('INTERFACE OPBOUWEN…');
    for (const { mount, html, naam } of ingeladen) {
      if (!mount.isConnected) continue;
      // Gebruik <template> + replaceWith zodat we een echte DocumentFragment
      // injecteren — voorkomt edge-cases met outerHTML en multi-root content.
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      mount.replaceWith(tpl.content);
      const eis = VERPLICHTE_IDS[naam];
      if (eis && !document.getElementById(eis)) {
        // De injectie slaagde technisch maar de inhoud klopt niet —
        // SW serveerde waarschijnlijk een verkeerde response.
        console.error(`[Partials] na injectie van '${naam}' ontbreekt #${eis}`);
        await Partials._herstel(`Onvolledige inhoud: ${naam}`, setStatus);
        throw new Error(`Verplicht id #${eis} ontbreekt na injectie van ${naam}`);
      }
    }
  }

  /** Wis caches + SW en reload — laatste redmiddel bij corruptie. */
  static async _herstel(reden, setStatus) {
    setStatus(`${reden} — herstelpoging…`);
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      console.error('[Partials] herstel mislukt:', e);
    }
    // Eenmalige reload-guard via sessionStorage zodat we niet in een
    // oneindige loop terechtkomen als het probleem niet aan SW ligt.
    const KEY = 'tanklog_partials_recovered';
    if (!sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, '1');
      setTimeout(() => location.reload(), 600);
    } else {
      setStatus('Herstel mislukt — clear je browser-cache handmatig');
    }
  }
}

export default Partials;
