// ── SettingsBindings ──────────────────────────────────────────────────────────
// Bindt alle event-listeners voor de Instellingen-tab en aanverwante UI.
// Wordt eenmalig geïnitialiseerd vanuit App._toonApp().
import { Utils } from './Utils.js';
import { StorageInfo } from '../ui/StorageInfo.js';
import { ConfirmModal } from '../ui/ConfirmModal.js';
import { ThemaController } from '../ui/ThemaController.js';
import { InfoOverlay } from '../ui/InfoOverlay.js';

export class SettingsBindings {
  /**
   * @param {{
   *   db: import('./Database.js').Database,
   *   maandRecap: object,
   *   notif: object,
   *   kaart: object,
   *   afreken: object,
   *   rittenController: object,
   *   tankController: object,
   *   onderhoudController: object,
   *   vasteKosten: object,
   *   betalingen: object,
   *   stats: object,
   *   getBottomSheet: () => object|null,
   *   onHeatmap: () => void,
   * }} opts
   */
  constructor(opts) {
    this._db = opts.db;
    this._maandRecap = opts.maandRecap;
    this._notif = opts.notif;
    this._kaart = opts.kaart;
    this._afreken = opts.afreken;
    this._rittenController = opts.rittenController;
    this._tankController = opts.tankController;
    this._onderhoudController = opts.onderhoudController;
    this._vasteKosten = opts.vasteKosten;
    this._betalingen = opts.betalingen;
    this._stats = opts.stats;
    this._getBottomSheet = opts.getBottomSheet;
    this._onHeatmap = opts.onHeatmap;
  }

  /** Bind alle settings-gerelateerde UI in één aanroep. */
  bindAll() {
    this._bindKmInfoBtn();
    this._bindShortcutUrl();
    this._bindV3Instellingen();
    this._bindDbUpdated();
    this._bindMaandRecap();
    this._bindSysteem();
    this._bindNotificaties();
  }

  // ── Km-info knop ─────────────────────────────────────────────────────────

  _bindKmInfoBtn() {
    document.getElementById('btn-km-info')?.addEventListener('click', () => {
      InfoOverlay.toon('km');
    });
  }

  // ── iOS snelkoppeling ─────────────────────────────────────────────────────

  _bindShortcutUrl() {
    if (this._shortcutUrlGebonden) return;
    this._shortcutUrlGebonden = true;

    const urlEl = document.getElementById('shortcut-url');
    const kopieerBtn = document.getElementById('btn-shortcut-kopieer');
    if (!urlEl || !kopieerBtn) return;

    const url = window.location.origin + window.location.pathname + '?action=start';
    urlEl.textContent = url;

    kopieerBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(url).then(() => {
        Utils.toast('URL gekopieerd ✓');
      }).catch(() => {
        Utils.toast('Kopiëren mislukt', 'err');
      });
    });
  }

  // ── Maand-recap ───────────────────────────────────────────────────────────

  _bindMaandRecap() {
    if (this._maandRecapGebonden) return;
    this._maandRecapGebonden = true;

    document.getElementById('recap-trigger')?.addEventListener('click', () => {
      this._maandRecap.open();
    });

    const sub = document.getElementById('recap-trigger-sub');
    if (sub) {
      const nu = new Date();
      const peil = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
      const maand = peil.toLocaleString('nl-NL', { month: 'long' });
      sub.textContent = `Terugblik op ${maand} ${peil.getFullYear()}`;
    }

    this._maandRecap.controleerAutoStart();
  }

  // ── Systeem-sectie ────────────────────────────────────────────────────────

  async _bindSysteem() {
    if (this._systeemGebonden) return;
    this._systeemGebonden = true;

    const versieEl = document.getElementById('syst-versie');
    const storageEl = document.getElementById('syst-storage');
    const persistEl = document.getElementById('syst-persistent');

    const ververs = async () => {
      const versie = await StorageInfo.getVersion();
      if (versieEl) versieEl.textContent = versie || '—';

      const usage = await StorageInfo.usage();
      if (storageEl && usage) {
        const pct = usage.quota > 0 ? Math.round((usage.bytes / usage.quota) * 100) : 0;
        storageEl.textContent = `${StorageInfo.formatBytes(usage.bytes)} (${pct}%)`;
        storageEl.classList.toggle('gevaar', pct >= 85);
      } else if (storageEl) {
        storageEl.textContent = 'Onbekend';
      }

      const isPersist = await StorageInfo.isPersistent();
      if (persistEl) {
        if (isPersist === true) {
          persistEl.textContent = 'Beveiligd ✓';
          persistEl.classList.add('succes');
        } else if (isPersist === false) {
          persistEl.textContent = 'Niet beveiligd';
          persistEl.classList.add('gevaar');
        } else {
          persistEl.textContent = 'Niet ondersteund';
        }
      }
    };
    await ververs();

    document.getElementById('btn-clear-tiles')?.addEventListener('click', async () => {
      const ja = await ConfirmModal.toon({
        titel: 'Kaart-cache wissen?',
        tekst: 'De opgeslagen kaart-tiles worden verwijderd. Je app-data blijft staan; alleen kaarten moeten opnieuw geladen worden.',
        bevestigLabel: 'Wissen',
      });
      if (!ja) return;
      const ok = await StorageInfo.clearTiles();
      Utils.toast(ok ? 'Kaart-cache gewist ✓' : 'Kon cache niet wissen', ok ? 'ok' : 'err');
      ververs();
    });

    document.getElementById('btn-update-check')?.addEventListener('click', async () => {
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (!reg) { Utils.toast('Service worker niet actief — open de app via HTTPS', 'err'); return; }
        await reg.update();
        Utils.toast('Check gedaan — eventuele update verschijnt automatisch ✓');
      } catch {
        Utils.toast('Check mislukt — geen verbinding?', 'err');
      }
    });
  }

  // ── Notificaties-sectie ───────────────────────────────────────────────────

  async _bindNotificaties() {
    if (this._notifGebonden) return;
    this._notifGebonden = true;

    const status = this._notif.status();
    const masterChk = document.getElementById('notif-master');
    const detail = document.getElementById('notif-detail');
    const statusSub = document.getElementById('notif-status-sub');
    const dlChk = document.getElementById('notif-deadline');
    const dlDgn = document.getElementById('notif-deadline-dagen');
    const saChk = document.getElementById('notif-saldo');
    const saInp = document.getElementById('notif-saldo-drempel');

    const inst = this._db.getNotificatieInstellingen();
    if (masterChk) masterChk.checked = inst.aan;
    if (dlChk) dlChk.checked = inst.deadline_aan;
    if (dlDgn) dlDgn.value = inst.deadline_dagen;
    if (saChk) saChk.checked = inst.saldo_aan;
    if (saInp) saInp.value = inst.saldo_drempel;
    if (detail) detail.classList.toggle('hidden', !inst.aan);

    const renderStatus = () => {
      if (!statusSub) return;
      statusSub.classList.remove('geweigerd', 'toegestaan');
      if (!status.ondersteund) {
        statusSub.textContent = 'Niet ondersteund op dit apparaat';
        masterChk && (masterChk.disabled = true);
      } else if (Notification.permission === 'denied') {
        statusSub.textContent = 'Geweigerd — wijzig via browser-instellingen';
        statusSub.classList.add('geweigerd');
      } else if (Notification.permission === 'granted') {
        statusSub.textContent = 'Lokale meldingen op dit apparaat';
        statusSub.classList.add('toegestaan');
      } else {
        statusSub.textContent = 'Lokale meldingen op dit apparaat';
      }
    };
    renderStatus();

    masterChk?.addEventListener('change', async () => {
      if (masterChk.checked) {
        const perm = await this._notif.vraagToestemming();
        if (perm !== 'granted') {
          masterChk.checked = false;
          renderStatus();
          Utils.toast('Notificaties geweigerd', 'err');
          return;
        }
        this._db.setNotificatieInstellingen({ aan: true });
        detail?.classList.remove('hidden');
        renderStatus();
        this._notif.checkAlles();
      } else {
        this._db.setNotificatieInstellingen({ aan: false });
        detail?.classList.add('hidden');
      }
    });

    dlChk?.addEventListener('change', () => {
      this._db.setNotificatieInstellingen({ deadline_aan: dlChk.checked });
    });
    dlDgn?.addEventListener('change', () => {
      const n = parseInt(dlDgn.value, 10);
      if (Number.isFinite(n) && n >= 1) this._db.setNotificatieInstellingen({ deadline_dagen: n });
    });
    saChk?.addEventListener('change', () => {
      this._db.setNotificatieInstellingen({ saldo_aan: saChk.checked });
      if (saChk.checked) this._notif.resetMarkers();
    });
    saInp?.addEventListener('change', () => {
      const n = parseFloat(saInp.value);
      if (Number.isFinite(n) && n > 0) this._db.setNotificatieInstellingen({ saldo_drempel: n });
    });

    this._notif.checkAlles();
    if (!this._notifDbHook) {
      this._notifDbHook = true;
      let timer = null;
      window.addEventListener('db:updated', () => {
        clearTimeout(timer);
        timer = setTimeout(() => this._notif.checkAlles(), 500);
      });
    }
  }

  // ── v3 Instellingen-tab bindings ──────────────────────────────────────────

  _bindV3Instellingen() {
    if (this._v3Gebonden) return;
    this._v3Gebonden = true;

    const huidigThema = (() => {
      const t = this._db.getThema();
      return t === 'auto' ? 'klassiek' : t;
    })();
    document.querySelectorAll('input[name="thema"]').forEach((radio) => {
      radio.checked = (radio.value === huidigThema);
      radio.addEventListener('change', () => {
        if (radio.checked) ThemaController.set(radio.value);
      });
    });

    const stadiaInp = document.getElementById('stadia-key-inp');
    const stadiaBtn = document.getElementById('btn-stadia-save');
    if (stadiaInp) stadiaInp.value = this._db.getStadiaApiKey() || '';
    if (stadiaBtn && stadiaInp) {
      stadiaBtn.addEventListener('click', () => {
        this._db.setStadiaApiKey(stadiaInp.value);
        if (this._kaart && typeof this._kaart.refreshTiles === 'function') {
          this._kaart.refreshTiles();
        }
        Utils.toast('Kaart-instellingen opgeslagen ✓');
      });
    }

    const heatChk = document.getElementById('chk-heatmap');
    if (heatChk) {
      heatChk.checked = this._db.getKaartHeatmapAan();
      heatChk.addEventListener('change', () => {
        this._db.setKaartHeatmapAan(heatChk.checked);
        this._onHeatmap();
        Utils.toast(heatChk.checked ? 'Heatmap aan ✓' : 'Heatmap uit');
      });
    }
    document.getElementById('btn-stadia-info')?.addEventListener('click', () => {
      InfoOverlay.toon('kaart');
    });

    document.getElementById('afreken-knop')?.addEventListener('click', () => {
      this._afreken.openSheet();
    });

    document.getElementById('reset-auto-knop')?.addEventListener('click', async () => {
      const auto = this._db.getGeselecteerdeAuto();
      if (!auto) return;
      const ja = await ConfirmModal.toon({
        titel: 'Reset deze auto?',
        tekst: `Alle ritten, tankbeurten, onderhoud, vaste kosten en betalingen voor "${auto.naam}" worden verwijderd. De auto zelf blijft bestaan.`,
        bevestigLabel: 'Verwijder',
        gevaarlijk: true,
      });
      if (!ja) return;
      this._db.resetAuto(auto.id);
      this._refreshAlles();
      Utils.toast('Auto gereset ✓');
    });
  }

  // ── db:updated listener + volledige refresh ───────────────────────────────

  _bindDbUpdated() {
    if (this._dbUpdatedGebonden) return;
    this._dbUpdatedGebonden = true;
    let timer = null;
    window.addEventListener('db:updated', () => {
      clearTimeout(timer);
      timer = setTimeout(() => this._refreshAlles(), 100);
    });
  }

  _refreshAlles() {
    this._rittenController.render();
    this._tankController.render();
    this._tankController.laadStandaard();
    this._onderhoudController.render();
    this._vasteKosten.render();
    this._betalingen.render();
    this._stats.updateSaldo();
    this._stats.updateOverzicht();
    this._stats.updateInstellingen?.();
    this._getBottomSheet()?.updateQuickStats();
    this._onHeatmap();
  }
}
