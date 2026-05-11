// ── DataManager ───────────────────────────────────────────────────────────────
// Beheert export, import en reset van de volledige dataset.
import { Utils } from './Utils.js';

export class DataManager {
  constructor(db) {
    this._db = db;
    this._bindEvents();
  }

  exporteer() {
    const blob = new Blob([JSON.stringify(this._db.load(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tanklog-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  importeer() {
    document.getElementById('import-file').click();
  }

  // Twee-staps bevestiging via de knop zelf (geen browser confirm)
  reset() {
    const btn = document.getElementById('btn-reset');
    if (!btn) return;

    if (btn.dataset.confirm === '1') {
      this._db.verwijderAlles();
      location.reload();
    } else {
      btn.dataset.confirm = '1';
      btn.textContent = 'Weet je het zeker? (Tik nogmaals)';
      setTimeout(() => {
        if (btn.dataset.confirm === '1') {
          btn.dataset.confirm = '';
          btn.textContent = 'Verwijder alle data';
        }
      }, 4000);
    }
  }

  _bindEvents() {
    document.getElementById('import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!Array.isArray(data.autos) || !Array.isArray(data.ritten) || !Array.isArray(data.tankbeurten))
            throw new Error('Ongeldig formaat');
          if (!Array.isArray(data.onderhoud)) data.onderhoud = [];
          this._db.save(data);
          Utils.toast('Geïmporteerd ✓');
          setTimeout(() => location.reload(), 800);
        } catch {
          Utils.toast('Fout bij importeren — ongeldig JSON bestand.', 'err');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }
}
