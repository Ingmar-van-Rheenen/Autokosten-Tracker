// ── SaldoWidget ──────────────────────────────────────────────────────────────
// Toont het live saldo, een uitleg-zin en drie mini-stats (gereden, brandstof,
// vaste lasten per maand). Geen interne state; render() is idempotent.
import { Utils } from '../../core/Utils.js';

export class SaldoWidget {
  constructor(db) {
    this._db = db;
    this._vorigeSaldo = null;
  }

  render(auto) {
    const ritten = this._db.getAutoRitten(auto.id) || [];
    const tank = this._db.getAutoTankbeurten(auto.id) || [];
    const vk = this._db.getAutoVasteKosten?.(auto.id) || [];

    const { saldo, betaald, gereden } = Utils.berekenSaldo(ritten, tank, auto);

    const val = document.getElementById('dash-saldo-val');
    if (val) {
      const nieuw = (saldo >= 0 ? '+ ' : '− ') + Utils.eur(saldo);
      if (val.textContent !== nieuw) {
        val.textContent = nieuw;
        // Flash bij wijziging — niet bij allereerste paint (vorigeSaldo===null)
        if (this._vorigeSaldo !== null && Math.abs(this._vorigeSaldo - saldo) > 0.005) {
          val.classList.remove('widget-val-flash');
          // eslint-disable-next-line no-unused-expressions
          val.offsetWidth;
          val.classList.add('widget-val-flash');
        }
      }
      val.classList.remove('negatief', 'neutraal');
      if (saldo < -0.005) val.classList.add('negatief');
      else if (Math.abs(saldo) <= 0.005) val.classList.add('neutraal');
      this._vorigeSaldo = saldo;
    }

    const uitleg = document.getElementById('dash-saldo-uitleg');
    if (uitleg) {
      uitleg.textContent = saldo > 0.005
        ? 'Je hebt meer getankt dan gereden. Vraag het bedrag terug.'
        : saldo < -0.005
          ? 'Je hebt meer gereden dan getankt. Tijd om af te rekenen.'
          : 'Niets meer te verrekenen.';
    }

    const km = document.getElementById('dash-saldo-km');
    if (km) km.textContent = gereden.toFixed(1).replace('.', ',') + ' km';

    const brand = document.getElementById('dash-saldo-brand');
    if (brand) brand.textContent = Utils.eur(betaald);

    const vasteTot = vk.reduce((acc, v) => {
      const b = Number(v.bedrag || 0);
      return acc + (v.frequentie === 'jaarlijks' ? b / 12 : b);
    }, 0);
    const vast = document.getElementById('dash-saldo-vast');
    if (vast) vast.textContent = Utils.eur(vasteTot) + ' /m';
  }
}

export default SaldoWidget;
