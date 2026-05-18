// ── Partials ──────────────────────────────────────────────────────────────────
const PARTIALS_VERSION = 'v8-domparser-strip';

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

      if (naam === 'app/kaart-tab') {
        console.log(`[Partials] na kaart-tab injectie:`,
          'btn-start =', !!document.getElementById('btn-start'),
          'btn-stop =', !!document.getElementById('btn-stop'),
          'btn-opslaan =', !!document.getElementById('btn-opslaan'),
          'btn-annuleer =', !!document.getElementById('btn-annuleer'));
      }
    }
  }
}

export default Partials;
