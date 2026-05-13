// ── ConfirmModal ──────────────────────────────────────────────────────────────
// Vervangt browser-native confirm(). Gebruikt #modal-confirm bottom-sheet.
// Statische helper, identiek patroon als Changelog / InfoOverlay.

export class ConfirmModal {
  /**
   * Toont de bevestig-modal.
   * @param {Object} opts
   * @param {string} opts.titel
   * @param {string} opts.tekst
   * @param {string} [opts.bevestigLabel='Bevestig']
   * @param {string} [opts.annuleerLabel='Annuleer']
   * @param {boolean} [opts.gevaarlijk=false] - kleurt bevestig-knop rood
   * @returns {Promise<boolean>}
   */
  static toon({
    titel,
    tekst,
    bevestigLabel = 'Bevestig',
    annuleerLabel = 'Annuleer',
    gevaarlijk = false,
  } = {}) {
    const modal = document.getElementById('modal-confirm');
    if (!modal) {
      // Fallback: als markup ontbreekt, return false zonder crash
      console.warn('[ConfirmModal] #modal-confirm niet gevonden in DOM');
      return Promise.resolve(false);
    }

    const titelEl = modal.querySelector('.cm-titel');
    const tekstEl = modal.querySelector('.cm-tekst');
    const annuleerBtn = modal.querySelector('.cm-annuleer');
    const bevestigBtn = modal.querySelector('.cm-bevestig');
    const backdrop = modal.querySelector('.cm-backdrop');

    if (titelEl) titelEl.textContent = titel || '';
    if (tekstEl) tekstEl.textContent = tekst || '';
    if (annuleerBtn) annuleerBtn.textContent = annuleerLabel;
    if (bevestigBtn) bevestigBtn.textContent = bevestigLabel;

    if (gevaarlijk) {
      modal.setAttribute('data-gevaarlijk', 'true');
    } else {
      modal.removeAttribute('data-gevaarlijk');
    }

    // Open animatie
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => modal.classList.add('is-open'));
    });

    return new Promise((resolve) => {
      let opgelost = false;

      const opruimen = (resultaat) => {
        if (opgelost) return;
        opgelost = true;

        bevestigBtn?.removeEventListener('click', opBevestig);
        annuleerBtn?.removeEventListener('click', opAnnuleer);
        backdrop?.removeEventListener('click', opAnnuleer);
        document.removeEventListener('keydown', opToets);

        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
          modal.classList.add('hidden');
          modal.removeAttribute('data-gevaarlijk');
        }, 280);

        resolve(resultaat);
      };

      const opBevestig = () => opruimen(true);
      const opAnnuleer = () => opruimen(false);
      const opToets = (e) => {
        if (e.key === 'Escape') opruimen(false);
        else if (e.key === 'Enter') opruimen(true);
      };

      bevestigBtn?.addEventListener('click', opBevestig);
      annuleerBtn?.addEventListener('click', opAnnuleer);
      backdrop?.addEventListener('click', opAnnuleer);
      document.addEventListener('keydown', opToets);
    });
  }
}

export default ConfirmModal;
