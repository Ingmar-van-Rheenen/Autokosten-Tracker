// ── Partials ──────────────────────────────────────────────────────────────────
// Laadt HTML-fragmenten uit /partials/ en injecteert ze in placeholders.
//
// Partials hebben extensie `.partial` (niet `.html`) zodat VS Code Live
// Server hun content niet aanraakt — Live Server injecteert een
// hot-reload <script> in elke HTML-response, en doet dat soms midden in
// de markup (zonder </body> als anchor), wat de partial onbruikbaar maakt.
// Een onbekende extensie krijgt geen injectie.
import { Utils } from './Utils.js';

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
        const res = await fetch(`partials/${naam}.partial`, { cache: 'no-store' });
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
    for (const { mount, html } of ingeladen) {
      if (!mount.isConnected || !html) continue;
      const doc = parser.parseFromString(html, 'text/html');
      const fragment = document.createDocumentFragment();
      while (doc.body.firstChild) {
        fragment.appendChild(doc.body.firstChild);
      }
      mount.replaceWith(fragment);
    }

    const mislukt = ingeladen.filter((r) => !r.html).length;
    if (mislukt > 0) {
      Utils.toast(
        `Let op: niet alle app-onderdelen konden worden geladen. Herlaad de pagina (${mislukt} mislukt).`,
        'fout'
      );
    }
  }
}

export default Partials;
