// ── Partials ──────────────────────────────────────────────────────────────────
const PARTIALS_VERSION = 'v9-diag';

export class Partials {
  static async load() {
    console.log(`[Partials] ${PARTIALS_VERSION} actief`);
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

      if (naam === 'app/kaart-tab') {
        // 1. Raw HTML check
        const heeftBtnStart = html.includes('btn-start');
        const heeftInjectie = html.includes('Code injected by live-server');
        const injectieIndex = html.indexOf('Code injected by live-server');
        console.log(`[diag] kaart-tab raw: ${html.length} bytes, btn-start in raw: ${heeftBtnStart}, live-server injectie: ${heeftInjectie}${heeftInjectie ? ` (idx ${injectieIndex})` : ''}`);
        if (heeftInjectie) {
          // Toon ~200 chars rond het injectie-punt
          console.log(`[diag] context rond injectie:`, JSON.stringify(html.slice(Math.max(0, injectieIndex - 100), injectieIndex + 200)));
        }
      }

      const doc = parser.parseFromString(html, 'text/html');
      const scriptsGevonden = doc.querySelectorAll('script').length;
      doc.querySelectorAll('script').forEach((s) => s.remove());

      if (naam === 'app/kaart-tab') {
        console.log(`[diag] kaart-tab na DOMParser+stripScripts:`,
          `${scriptsGevonden} scripts geremoved,`,
          `body heeft ${doc.body.children.length} top-level kids,`,
          `btn-start in body:`, !!doc.body.querySelector('#btn-start'),
          `alle id's:`, Array.from(doc.body.querySelectorAll('[id]')).map((e) => e.id));
      }

      const fragment = document.createDocumentFragment();
      while (doc.body.firstChild) {
        fragment.appendChild(doc.body.firstChild);
      }
      mount.replaceWith(fragment);
    }
  }
}

export default Partials;
