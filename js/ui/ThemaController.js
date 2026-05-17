// ── ThemaController ───────────────────────────────────────────────────────────
// Beheert het actieve thema (auto/licht/donker). Schrijft naar data-thema op
// het html-element, volgt prefers-color-scheme bij 'auto'.
// Statische helper — geen instantie nodig.

export class ThemaController {
  /**
   * Initialiseert het thema bij app-start. MOET vóór de eerste render lopen
   * zodat de UI direct in de juiste kleur opbouwt.
   * @param {import('./Database.js').Database} db
   */
  static init(db) {
    ThemaController._db = db;
    const opgeslagen = (db && typeof db.getThema === 'function') ? db.getThema() : 'klassiek';
    // Migreer oude 'auto' waarde naar 'klassiek'
    const thema = opgeslagen === 'auto' ? 'klassiek' : opgeslagen;
    ThemaController._pas_toe(thema);
  }

  /**
   * Zet een nieuw thema. Persist naar Database en past DOM aan.
   * @param {'klassiek'|'licht'|'donker'} thema
   */
  static set(thema) {
    if (!['klassiek', 'licht', 'donker'].includes(thema)) return;
    ThemaController._pas_toe(thema);
    if (ThemaController._db && typeof ThemaController._db.setThema === 'function') {
      ThemaController._db.setThema(thema);
    }
    window.dispatchEvent(new CustomEvent('thema:gewijzigd', { detail: { thema } }));
  }

  static _pas_toe(thema) {
    ThemaController._actief = thema;
    document.documentElement.setAttribute('data-thema', thema);
  }
}

ThemaController._actief = 'klassiek';
ThemaController._db = null;

export default ThemaController;
