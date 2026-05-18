// ── Partials ──────────────────────────────────────────────────────────────────
// Laadt HTML-fragmenten uit /partials/ en injecteert ze in placeholders.
//
// LET OP: VS Code Live Server injecteert een hot-reload <script> blok in
// élke HTML-response. Bij een volledige pagina komt dat netjes vóór </body>;
// bij een partial (zonder </body>) injecteert hij MIDDEN in de HTML —
// vaak in een <svg> element — waardoor de HTML5-parser de boom verkeerd
// opbouwt en alle elementen na het injectie-punt verloren gaan. We strippen
// het injectie-blok daarom voor we de partial parsen.

const LIVE_SERVER_RE = /<!--\s*Code injected by live-server\s*-->[\s\S]*?<\/script>\s*/gi;

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
        let html = await res.text();
        // Strip Live Server hot-reload injectie zodat de partial-parser
        // een schone HTML-tree krijgt.
        html = html.replace(LIVE_SERVER_RE, '');
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
    for (const { mount, html } of ingeladen) {
      if (!mount.isConnected || !html) continue;
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      mount.replaceWith(tpl.content);
    }
  }
}

export default Partials;
