// ── Partials ──────────────────────────────────────────────────────────────────
// Laadt HTML-fragmenten uit /partials/ en injecteert ze in placeholders.
//
// LET OP: VS Code Live Server injecteert een hot-reload <script> blok in
// elke HTML-response. Bij een partial (geen </body>) injecteert hij dat
// vaak midden in de markup, soms binnen een <svg>, waardoor de parser de
// boom verkeerd opbouwt en elementen erna verloren gaan.
//
// Robuuste aanpak:
//   1. fetch met `cache: 'no-store'` om browser-cache te omzeilen.
//   2. Parse de hele HTML met DOMParser in document-modus (i.p.v.
//      <template>.innerHTML) — DOMParser bouwt een echt document op met
//      head/body en is veel forgivender voor rogue scripts.
//   3. Verwijder alle <script>-tags uit het geparste document voor we het
//      in onze DOM hangen — partials horen geen scripts te bevatten.

export class Partials {
  static async load() {
    const mounts = Array.from(document.querySelectorAll('[data-partial]'));
    if (!mounts.length) return;

    const setStatus = (t) => {
      const el = document.querySelector('.splash-loader-text');
      if (el) el.textContent = t;
    };
    let klaar = 0;
    const totaal = mounts.length;
    setStatus(`BESTANDEN LADEN… 0/${totaal}`);

    const ingeladen = await Promise.all(mounts.map(async (mount) => {
      const naam = mount.getAttribute('data-partial');
      try {
        const res = await fetch(`partials/${naam}.html`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        klaar++;
        setStatus(`BESTANDEN LADEN… ${klaar}/${totaal}`);
        return { mount, html, naam };
      } catch (e) {
        klaar++;
        console.error(`[Partials] ${naam} niet geladen:`, e);
        setStatus(`BESTANDEN LADEN… ${klaar}/${totaal}`);
        return { mount, html: '', naam };
      }
    }));

    setStatus('INTERFACE OPBOUWEN…');
    const parser = new DOMParser();
    for (const { mount, html, naam } of ingeladen) {
      if (!mount.isConnected || !html) continue;

      // Parse als compleet HTML-document — DOMParser is robuust tegen
      // rogue <script>-injecties (zoals die van Live Server) omdat hij
      // alles netjes in body/head plaatst.
      const doc = parser.parseFromString(html, 'text/html');

      // Strip alle scripts — partials horen er geen te bevatten, en
      // Live Server's hot-reload script breekt anders de structuur.
      doc.querySelectorAll('script').forEach((s) => s.remove());

      // Verzamel alle body-children in een fragment en injecteer.
      const fragment = document.createDocumentFragment();
      while (doc.body.firstChild) {
        fragment.appendChild(doc.body.firstChild);
      }
      mount.replaceWith(fragment);
    }
  }
}

export default Partials;
