// ── Partials ──────────────────────────────────────────────────────────────────
// Laadt HTML-fragmenten parallel uit /partials/ en vervangt elk
// `<div data-partial="path"></div>` placeholder met de inhoud van het
// bijbehorende bestand. Wordt eenmaal aangeroepen voor App.init() zodat
// elke `document.getElementById(...)` aanwezig is.
//
// Tijdens fetch wordt de splash-loader-text bijgewerkt met voortgang
// zodat de gebruiker geen statische "APP VOORBEREIDEN…" tekst ziet.
// De service worker (sw.js) precached alle partials, dus na de eerste
// install zijn ze instant beschikbaar en flitst de progress kort door.

export class Partials {
  /**
   * Vervang alle data-partial placeholders door hun HTML-inhoud.
   * Resolved zodra alle fetches binnen + ingevoegd zijn.
   */
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
      if (!naam) return { mount, html: '' };
      try {
        const res = await fetch(`partials/${naam}.html`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        klaar++;
        setStatus(`BESTANDEN LADEN… ${klaar}/${totaal}`);
        return { mount, html };
      } catch (e) {
        klaar++;
        console.error(`[Partials] kon partials/${naam}.html niet laden:`, e);
        setStatus(`BESTANDEN LADEN… ${klaar}/${totaal}`);
        return { mount, html: '' };
      }
    }));

    setStatus('INTERFACE OPBOUWEN…');
    // Vervang placeholders in volgorde (outerHTML zodat de wrapper-div
    // zelf weg is en de partial-inhoud op zijn plek staat).
    for (const { mount, html } of ingeladen) {
      if (!mount.isConnected) continue;
      mount.outerHTML = html;
    }
  }
}

export default Partials;
