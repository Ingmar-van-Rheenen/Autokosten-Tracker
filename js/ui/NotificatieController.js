// ── NotificatieController ─────────────────────────────────────────────────────
// Lokale notificaties via de SW (geen backend nodig):
//   • Deadline-waarschuwingen voor vaste kosten met een naderend eind_datum
//     (APK, verzekering, …). Default 14 dagen vooruit.
//   • Saldo-drempel: notificatie zodra het saldo onder een gebruiker-gekozen
//     bedrag duikt (bv. "je staat €25 in de min").
//
// "Al gestuurd"-markers staan in localStorage zodat je niet bij elke
// app-opening dezelfde notificatie krijgt.
import { Utils } from '../core/Utils.js';

const VK_TYPE_LABELS = {
  verzekering: 'Verzekering',
  wegenbelasting: 'Wegenbelasting',
  apk: 'APK',
  onderhoud: 'Onderhoud',
  parkeren: 'Parkeervergunning',
  overig: 'Vaste kost',
};

const PFX_DEADLINE = 'tanklog_notif_deadline_';
const PFX_SALDO    = 'tanklog_notif_saldo_';

export class NotificatieController {
  constructor(db) {
    this._db = db;
  }

  /** Algemene status: ondersteund + huidige permissie. */
  status() {
    const ondersteund = 'Notification' in window
      && 'serviceWorker' in navigator;
    return {
      ondersteund,
      permissie: ondersteund ? Notification.permission : 'denied',
    };
  }

  /** Vraag toestemming. Resolved met de uiteindelijke permissie-status. */
  async vraagToestemming() {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied')  return 'denied';
    try { return await Notification.requestPermission(); }
    catch { return 'denied'; }
  }

  /**
   * Controleer beide categorieën tegen de huidige data en stuur eventueel
   * notificaties. Idempotent: per item/dag maar één keer.
   */
  async checkAlles() {
    const inst = this._db.getNotificatieInstellingen();
    if (!inst.aan) return;
    if (!this._kanVersturen()) return;

    if (inst.deadline_aan) await this._checkDeadlines(inst.deadline_dagen);
    if (inst.saldo_aan)    await this._checkSaldo(inst.saldo_drempel);
  }

  /** Reset "al verstuurd"-markers — bv. wanneer de gebruiker notificaties opnieuw aanzet. */
  resetMarkers() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PFX_DEADLINE) || k.startsWith(PFX_SALDO))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* opslag onbeschikbaar */ }
  }

  // ── Deadlines ─────────────────────────────────────────────────────────────

  async _checkDeadlines(dagenVoor) {
    const d = this._db.load();
    const items = d.vaste_kosten || [];
    const nu = new Date();
    const grens = new Date(nu);
    grens.setDate(nu.getDate() + dagenVoor);

    for (const v of items) {
      if (!v.eind_datum) continue;
      const eind = new Date(v.eind_datum);
      if (Number.isNaN(eind.getTime())) continue;
      if (eind < nu) continue;          // al verlopen → geen melding meer
      if (eind > grens) continue;       // nog niet binnen het venster

      // Per record + maand: maximaal één notificatie. Dat houdt het rustig
      // ook al check je vaak.
      const periodeKey = `${eind.getFullYear()}-${eind.getMonth()}`;
      const sleutel = PFX_DEADLINE + v.id + '_' + periodeKey;
      if (localStorage.getItem(sleutel)) continue;

      const auto = (d.autos || []).find((a) => a.id === v.auto_id);
      const typeLbl = VK_TYPE_LABELS[v.type] || 'Vaste kost';
      const dagen = Math.max(0, Math.round((eind - nu) / (1000 * 60 * 60 * 24)));
      const naamAuto = auto ? (auto.naam || 'auto') : 'je auto';

      const titel = `${typeLbl} verloopt over ${dagen} ${dagen === 1 ? 'dag' : 'dagen'}`;
      const body = `${v.label || typeLbl} van ${naamAuto} verloopt op ${eind.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}.`;

      await this._toon(titel, body, { tag: 'deadline-' + v.id, url: '/?tab=overzicht' });
      try { localStorage.setItem(sleutel, String(Date.now())); } catch { /* quota */ }
    }
  }

  // ── Saldo-drempel ─────────────────────────────────────────────────────────

  async _checkSaldo(drempel) {
    const auto = this._db.getGeselecteerdeAuto();
    if (!auto) return;
    const ritten = this._db.getAutoRitten(auto.id) || [];
    const tank = this._db.getAutoTankbeurten(auto.id) || [];
    const { saldo } = Utils.berekenSaldo(ritten, tank, auto);

    // Drempel = absolute waarde "in de min". Saldo < -drempel → notificeer.
    if (saldo > -Math.abs(drempel)) {
      // Boven de drempel → markeer als "niet meer in de gevarenzone" zodat
      // de notificatie opnieuw kan triggeren als hij later weer zakt.
      try { localStorage.removeItem(this._saldoKey(auto.id)); } catch { /* */ }
      return;
    }

    const sleutel = this._saldoKey(auto.id);
    // Max eens per dag — anders kan een drukke dag spammen.
    const laatste = parseInt(localStorage.getItem(sleutel) || '0', 10);
    const eenDag = 24 * 60 * 60 * 1000;
    if (Date.now() - laatste < eenDag) return;

    const titel = `Saldo onder grens voor ${auto.naam}`;
    const body  = `Je staat ${Utils.eur(saldo)} in de min — tijd om af te rekenen.`;
    await this._toon(titel, body, { tag: 'saldo-' + auto.id, url: '/?tab=saldo' });
    try { localStorage.setItem(sleutel, String(Date.now())); } catch { /* */ }
  }

  _saldoKey(autoId) { return PFX_SALDO + autoId; }

  // ── Versturen via SW ──────────────────────────────────────────────────────

  _kanVersturen() {
    const s = this.status();
    return s.ondersteund && s.permissie === 'granted';
  }

  async _toon(titel, body, opts) {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg || typeof reg.showNotification !== 'function') return;
    try {
      await reg.showNotification(titel, {
        body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: opts && opts.tag,
        renotify: false,
        data: { url: (opts && opts.url) || '/' },
      });
    } catch { /* permissie ingetrokken of API niet beschikbaar */ }
  }
}

export default NotificatieController;
