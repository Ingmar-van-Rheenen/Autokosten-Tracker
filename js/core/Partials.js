// ── Partials ──────────────────────────────────────────────────────────────────
// Laadt HTML-fragmenten parallel uit /partials/ en vervangt elk
// `<div data-partial="path"></div>` placeholder met de inhoud van het
// bijbehorende bestand. Wordt eenmaal aangeroepen voor App.init() zodat
// elke `document.getElementById(...)` aanwezig is.
//
// De service worker (sw.js) precached alle partials, dus na de eerste
// install zijn ze instant beschikbaar.

export class Partials {
  /**
   * Vervang alle data-partial placeholders door hun HTML-inhoud.
   * Resolved zodra alle fetches binnen + ingevoegd zijn.
   */
  static async load() {
    const mounts = Array.from(document.querySelectorAll('[data-partial]'));
    if (!mounts.length) return;

    const ingeladen = await Promise.all(mounts.map(async (mount) => {
      const naam = mount.getAttribute('data-partial');
      if (!naam) return { mount, html: '' };
      try {
        const res = await fetch(`partials/${naam}.html`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        return { mount, html };
      } catch (e) {
        console.error(`[Partials] kon partials/${naam}.html niet laden:`, e);
        return { mount, html: '' };
      }
    }));

    // Vervang placeholders in volgorde (outerHTML zodat de wrapper-div
    // zelf weg is en de partial-inhoud op zijn plek staat).
    for (const { mount, html } of ingeladen) {
      if (!mount.isConnected) continue;
      mount.outerHTML = html;
    }
  }
}

export default Partials;
