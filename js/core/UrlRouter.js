// ── UrlRouter ─────────────────────────────────────────────────────────────────
// Verwerkt URL query-parameters bij app-start: ?action=, ?tab=, en
// share-target parameters (?share_title=, ?share_text=, ?share_url=).
import { Utils } from './Utils.js';

export class UrlRouter {
  /**
   * @param {{
   *   navigeerNaarTab: (tab: string) => void,
   *   getDesktopDashboard: () => any,
   * }} opts
   */
  constructor(opts) {
    this._navigeerNaarTab = opts.navigeerNaarTab;
    this._getDesktopDashboard = opts.getDesktopDashboard;
  }

  /** Lees de huidige URL-params en voer de overeenkomstige actie uit. */
  verwerk() {
    const params = new URLSearchParams(window.location.search);
    const actie = params.get('action');
    if (!actie) return;

    history.replaceState(null, '', window.location.pathname);

    if (actie === 'start') {
      setTimeout(() => document.getElementById('btn-start')?.click(), 400);
    }

    // Share-target: vanuit Google Maps / browser-share opent Tanklog met
    // ?share_title=… &share_text=… &share_url=…  Wij plukken er een leesbare
    // bestemming uit (titel of tekst) en openen het rit-toevoegen-flow.
    const titel = params.get('share_title');
    const tekst = params.get('share_text');
    const url   = params.get('share_url');
    if (titel || tekst || url) {
      const bestemming = (titel || tekst || url || '').trim().slice(0, 120);
      setTimeout(() => this._openRitMetBestemming(bestemming), 600);
    }

    // Direct naar een specifieke tab (gebruikt door notif-clicks)
    const tab = params.get('tab');
    if (tab && ['kaart', 'ritten', 'saldo', 'overzicht', 'instellingen'].includes(tab)) {
      setTimeout(() => this._navigeerNaarTab(tab), 400);
    }
  }

  /**
   * Open de "nieuwe rit"-flow met een voor-ingevulde bestemming. Gebruikt
   * de DesktopModals op desktop en de mobile rit-flow op kleinere schermen.
   */
  _openRitMetBestemming(bestemming) {
    if (!bestemming) return;
    const desktop = window.matchMedia('(min-width: 1280px)').matches;
    const dashboard = this._getDesktopDashboard?.();
    if (desktop && dashboard?._modals?.openRit) {
      dashboard._modals.openRit();
      const inp = document.getElementById('desk-rit-bestemming');
      if (inp) { inp.value = bestemming; inp.dispatchEvent(new Event('input')); }
    } else {
      Utils.toast(`Bestemming: ${bestemming}`);
    }
  }
}
