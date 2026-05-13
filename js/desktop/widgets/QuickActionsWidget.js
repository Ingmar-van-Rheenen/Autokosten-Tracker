// ── QuickActionsWidget ──────────────────────────────────────────────────────
// 3 snel-toevoegen knoppen. Geen interne render (markup is statisch in
// index.html); de DesktopDashboard orchestrator handlet de klikken via
// data-actie attributes. Deze class is een placeholder voor consistentie en
// kan later eigen gedrag krijgen (bijv. inline rit-formulier).

export class QuickActionsWidget {
  constructor(db) {
    this._db = db;
  }

  render(_auto) {
    // Statische markup, niets te updaten per render.
  }
}

export default QuickActionsWidget;
