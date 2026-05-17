// ── SyncController ───────────────────────────────────────────────────────────
// Twee manieren om Tanklog-data tussen twee devices over te zetten:
//
// 1. DEEL ALS BESTAND  (navigator.share() of download-fallback)
//    Werkt overal. Op iOS opent de share-sheet (AirDrop, Mail, Messages).
//    Op desktop fallt het terug op een download.
//
// 2. DIRECT VERBINDEN  (WebRTC via PeerJS public broker)
//    Eén kant 'host': genereert 6-cijferige code en toont 'm.
//    Andere kant 'gast': typt de code in en ontvangt de data.
//    Geen account, geen server-setup. PeerJS-broker doet alleen de
//    handshake; daarna gaat data direct van device naar device.
//
// Beide methodes gebruiken hetzelfde JSON-payload format als DataManager
// zodat de import-flow (replace / merge via ConfirmModal) gedeeld is.

import { Utils } from '../core/Utils.js';
import { ConfirmModal } from '../ui/ConfirmModal.js';

const PEER_PREFIX = 'tanklog-sync-';

export class SyncController {
  /**
   * @param {import('./Database.js').Database} db
   * @param {import('./DataManager.js').DataManager} dataManager
   */
  constructor(db, dataManager) {
    this._db = db;
    this._dm = dataManager;
    this._peer = null;
    this._connectie = null;
    this._gebonden = false;
  }

  init() {
    if (this._gebonden) return;
    this._gebonden = true;

    document.getElementById('sync-deel-knop')?.addEventListener('click', () => this.deelAlsBestand());
    document.getElementById('sync-host-knop')?.addEventListener('click', () => this.startHost());
    document.getElementById('sync-gast-knop')?.addEventListener('click', () => this.startGast());
    document.getElementById('sync-annuleer-knop')?.addEventListener('click', () => this.annuleer());
    document.getElementById('sync-verbind-knop')?.addEventListener('click', () => {
      const inp = document.getElementById('sync-code-inp');
      if (inp) this.verbindMetCode(inp.value.trim());
    });
  }

  // ── 1. DEEL ALS BESTAND ──────────────────────────────────────────────

  async deelAlsBestand() {
    try {
      const data = this._db.load();
      const json = JSON.stringify(data, null, 2);
      const datum = new Date().toISOString().split('T')[0];
      const bestandsnaam = `tanklog-${datum}.json`;
      const blob = new Blob([json], { type: 'application/json' });
      const file = new File([blob], bestandsnaam, { type: 'application/json' });

      // Probeer eerst Web Share API met bestand (werkt op iOS/Android,
      // desktop Safari, ondersteund Chrome desktop sinds 2023)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Tanklog data',
          text: 'Tanklog backup ' + datum,
        });
        Utils.toast('Gedeeld ✓');
        return;
      }

      // Fallback: download als bestand (Desktop browsers zonder share)
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = bestandsnaam;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      Utils.toast('Bestand gedownload');
    } catch (e) {
      // User cancelled or share failed
      if (e && e.name !== 'AbortError') {
        Utils.toast('Delen mislukt: ' + (e.message || e), 'err');
      }
    }
  }

  // ── 2. DIRECT VERBINDEN ─────────────────────────────────────────────

  /** Begin als HOST: maak peer met willekeurige 6-cijferige code, wacht op gast. */
  async startHost() {
    if (!this._zorgPeerJsBeschikbaar()) return;
    this.annuleer();

    const code = String(Math.floor(100000 + Math.random() * 900000));
    this._peer = new window.Peer(PEER_PREFIX + code, { debug: 1 });

    this._toonStatus('Code aanmaken...');
    this._toonCode(code, true);

    this._peer.on('open', () => {
      this._toonStatus('Wacht op andere device. Typ deze code op het andere apparaat.');
    });

    this._peer.on('connection', (conn) => {
      this._connectie = conn;
      this._toonStatus('Verbonden. Data versturen...');

      conn.on('open', () => {
        const payload = this._db.load();
        conn.send({ type: 'tanklog-data', data: payload });
        Utils.toast('Data verstuurd ✓');
        setTimeout(() => this.annuleer(), 1500);
      });

      conn.on('error', (err) => this._toonStatus('Fout: ' + err.message, true));
    });

    this._peer.on('error', (err) => {
      // Code al in gebruik? Probeer opnieuw met andere code.
      if (err.type === 'unavailable-id') {
        this._toonStatus('Code in gebruik, opnieuw proberen...');
        setTimeout(() => this.startHost(), 100);
      } else {
        this._toonStatus('Fout: ' + err.message, true);
      }
    });
  }

  /** Begin als GAST: toon code-input, verbind bij submit. */
  startGast() {
    if (!this._zorgPeerJsBeschikbaar()) return;
    this.annuleer();
    this._toonCodeInput();
  }

  async verbindMetCode(code) {
    if (!/^\d{6}$/.test(code)) {
      Utils.toast('Voer 6 cijfers in', 'err');
      return;
    }
    if (!this._zorgPeerJsBeschikbaar()) return;

    this._peer = new window.Peer({ debug: 1 });
    this._toonStatus('Verbinden met ' + code + '...');

    this._peer.on('open', () => {
      const conn = this._peer.connect(PEER_PREFIX + code, { reliable: true });
      this._connectie = conn;

      conn.on('open', () => {
        this._toonStatus('Verbonden. Wacht op data...');
      });

      conn.on('data', (bericht) => {
        if (bericht?.type === 'tanklog-data') {
          this._verwerkOntvangenData(bericht.data);
        }
      });

      conn.on('error', (err) => this._toonStatus('Fout: ' + err.message, true));
      conn.on('close', () => this.annuleer());
    });

    this._peer.on('error', (err) => {
      this._toonStatus('Fout: ' + err.message, true);
    });
  }

  /** Sluit lopende verbinding en reset UI. */
  annuleer() {
    if (this._connectie) {
      try { this._connectie.close(); } catch {}
      this._connectie = null;
    }
    if (this._peer) {
      try { this._peer.destroy(); } catch {}
      this._peer = null;
    }
    this._resetUi();
  }

  // ── DATA-OVERDRACHT — ontvangst handler ──────────────────────────────

  async _verwerkOntvangenData(data) {
    this._toonStatus('Data ontvangen. Kies hoe je hem wilt importeren.');

    const aantalRitten = (data.ritten?.length) || 0;
    const aantalTank = (data.tankbeurten?.length) || 0;
    const aantalAutos = (data.autos?.length) || 0;

    const ja = await ConfirmModal.toon({
      titel: 'Data ontvangen',
      tekst: `Ontvangen: ${aantalAutos} auto's, ${aantalRitten} ritten, ${aantalTank} tankbeurten. Vervang je huidige data of voeg samen?`,
      bevestigLabel: 'Vervang',
      annuleerLabel: 'Voeg samen',
      gevaarlijk: true,
    });

    // ConfirmModal geeft true voor 'Vervang', false voor 'Voeg samen'
    if (ja) {
      this._db.save(data);
      Utils.toast('Data vervangen ✓');
    } else {
      this._mergeData(data);
      Utils.toast('Data samengevoegd ✓');
    }
    this.annuleer();
  }

  /** Eenvoudige merge: voeg items toe als ID nog niet bestaat. */
  _mergeData(nieuw) {
    const huidig = this._db.load();
    const samenvoegen = (oud = [], extra = []) => {
      const ids = new Set(oud.map((x) => x.id));
      return oud.concat(extra.filter((x) => !ids.has(x.id)));
    };
    const samengevoegd = {
      ...huidig,
      autos: samenvoegen(huidig.autos, nieuw.autos),
      ritten: samenvoegen(huidig.ritten, nieuw.ritten),
      tankbeurten: samenvoegen(huidig.tankbeurten, nieuw.tankbeurten),
      vaste_kosten: samenvoegen(huidig.vaste_kosten, nieuw.vaste_kosten),
      betalingen: samenvoegen(huidig.betalingen, nieuw.betalingen),
      onderhoud: samenvoegen(huidig.onderhoud, nieuw.onderhoud),
    };
    this._db.save(samengevoegd);
  }

  // ── UI HELPERS ───────────────────────────────────────────────────────

  _zorgPeerJsBeschikbaar() {
    if (typeof window.Peer === 'undefined') {
      Utils.toast('PeerJS nog niet geladen, probeer over een paar seconden', 'err');
      return false;
    }
    return true;
  }

  _toonCode(code, alsHost) {
    const paneel = document.getElementById('sync-paneel');
    const codeEl = document.getElementById('sync-code-toon');
    const inputEl = document.getElementById('sync-code-input');
    const annuleer = document.getElementById('sync-annuleer-knop');
    if (paneel) paneel.classList.remove('hidden');
    if (codeEl) {
      codeEl.classList.toggle('hidden', !alsHost);
      codeEl.querySelector('.sync-code-cijfers').textContent = code;
    }
    if (inputEl) inputEl.classList.add('hidden');
    if (annuleer) annuleer.classList.remove('hidden');
  }

  _toonCodeInput() {
    const paneel = document.getElementById('sync-paneel');
    const codeEl = document.getElementById('sync-code-toon');
    const inputEl = document.getElementById('sync-code-input');
    const annuleer = document.getElementById('sync-annuleer-knop');
    if (paneel) paneel.classList.remove('hidden');
    if (codeEl) codeEl.classList.add('hidden');
    if (inputEl) {
      inputEl.classList.remove('hidden');
      const inp = document.getElementById('sync-code-inp');
      if (inp) { inp.value = ''; inp.focus(); }
    }
    if (annuleer) annuleer.classList.remove('hidden');
    this._toonStatus('Typ de 6-cijferige code van het andere device.');
  }

  _toonStatus(tekst, isFout = false) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    el.textContent = tekst;
    el.classList.toggle('fout', isFout);
    el.classList.remove('hidden');
  }

  _resetUi() {
    document.getElementById('sync-paneel')?.classList.add('hidden');
    document.getElementById('sync-status')?.classList.add('hidden');
    document.getElementById('sync-code-toon')?.classList.add('hidden');
    document.getElementById('sync-code-input')?.classList.add('hidden');
    document.getElementById('sync-annuleer-knop')?.classList.add('hidden');
  }
}

export default SyncController;
