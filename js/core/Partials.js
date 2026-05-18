// ── Partials ──────────────────────────────────────────────────────────────────
// Laadt HTML-fragmenten parallel uit /partials/ en vervangt elk
// `<div data-partial="path"></div>` placeholder met de inhoud van het
// bijbehorende bestand. Wordt eenmaal aangeroepen voor App.init() zodat
// elke `document.getElementById(...)` aanwezig is.
//
// Tijdens fetch wordt de splash-loader-text bijgewerkt met voortgang.
// Bij een failure laten we de placeholder staan + loggen, in plaats van
// een lege string te injecteren — dat verwijderde voorheen het hele
// element waardoor App.init() crashte op missing id's.

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
        const res = await fetch(`partials/${naam}.html`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        if (!html || !html.trim()) throw new Error('leeg antwoord');
        klaar++;
        setStatus(`BESTANDEN LADEN… ${klaar}/${totaal}`);
        return { mount, html, naam };
      } catch (e) {
        klaar++;
        console.error(`[Partials] partials/${naam}.html niet geladen — placeholder blijft staan:`, e);
        setStatus(`BESTANDEN LADEN… ${klaar}/${totaal}`);
        return { mount, html: null, naam };
      }
    }));

    const mislukt = ingeladen.filter((x) => x.html === null);
    if (mislukt.length) {
      // Cache van een eerdere Service Worker bevatte vermoedelijk bad
      // responses. Probeer eenmalig de SW te unregisteren — bij volgende
      // refresh werkt het wel. Toon ook visueel aan de gebruiker.
      setStatus(`${mislukt.length} bestanden faalden — Service Worker resetten`);
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        // Hard reload na korte pauze zodat gebruiker de tekst ziet.
        setTimeout(() => location.reload(), 800);
      } catch (e) {
        console.error('[Partials] SW reset mislukt:', e);
      }
      throw new Error(`Partials niet geladen: ${mislukt.map((m) => m.naam).join(', ')}`);
    }

    setStatus('INTERFACE OPBOUWEN…');
    for (const { mount, html } of ingeladen) {
      if (!mount.isConnected) continue;
      mount.outerHTML = html;
    }
  }
}

export default Partials;
