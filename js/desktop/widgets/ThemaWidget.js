// ── ThemaWidget ─────────────────────────────────────────────────────────────
// 3-knops segmented control (klassiek / licht / donker). Sync't met de
// huidige Database-waarde; ThemaController.set wordt aangeroepen op klik.
import { ThemaController } from '../../ThemaController.js';

export class ThemaWidget {
  constructor(db) {
    this._db = db;
    this._gebonden = false;
  }

  render(_auto) {
    if (!this._gebonden) {
      this._gebonden = true;
      document.querySelectorAll('.dash-thema-knop').forEach((btn) => {
        btn.addEventListener('click', () => {
          const thema = btn.dataset.thema;
          if (thema) ThemaController.set(thema);
        });
      });
    }

    const huidig = (this._db.getThema && this._db.getThema()) || 'klassiek';
    const norm = huidig === 'auto' ? 'klassiek' : huidig;
    document.querySelectorAll('.dash-thema-knop').forEach((btn) => {
      btn.classList.toggle('actief', btn.dataset.thema === norm);
    });
  }
}

export default ThemaWidget;
