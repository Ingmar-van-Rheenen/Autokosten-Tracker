// ── DataManager ───────────────────────────────────────────────────────────────
// Beheert export, import en reset van de volledige dataset.
import { Utils } from '../core/Utils.js';
import { ConfirmModal } from '../ui/ConfirmModal.js';

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
    document.getElementById('import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;

      let data;
      try {
        const tekst = await file.text();
        data = JSON.parse(tekst);
        data = this._normaliseerImport(data);
        if (!data) throw new Error('Ongeldig formaat');
      } catch {
        Utils.toast('Fout bij importeren — ongeldig JSON bestand.', 'err');
        return;
      }

      // v3: conflict-resolution — vervangen of samenvoegen?
      const huidigEmpty = !(this._db.load().autos?.length || this._db.load().ritten?.length || this._db.load().tankbeurten?.length);
      if (huidigEmpty) {
        this._toepassenVervangen(data);
        return;
      }

      const vervang = await ConfirmModal.toon({
        titel: 'Bestaande data vervangen?',
        tekst: 'Je hebt al ritten/tankbeurten in de app. Wil je deze VERVANGEN door het importbestand, of beide samenvoegen?',
        bevestigLabel: 'Vervangen',
        annuleerLabel: 'Samenvoegen of annuleer',
      });

      if (vervang) {
        const def = await ConfirmModal.toon({
          titel: 'Zeker weten?',
          tekst: 'Alle bestaande ritten, tankbeurten, onderhoud, vaste kosten en betalingen worden overschreven.',
          bevestigLabel: 'Ja, vervangen',
          gevaarlijk: true,
        });
        if (!def) return;
        this._toepassenVervangen(data);
        return;
      }

      const merge = await ConfirmModal.toon({
        titel: 'Samenvoegen?',
        tekst: 'Records met dezelfde id worden overgeslagen. Nieuwe records worden toegevoegd.',
        bevestigLabel: 'Samenvoegen',
      });
      if (!merge) return;
      this._toepassenSamenvoegen(data);
    });
  }

  _toepassenVervangen(data) {
    if (!Array.isArray(data.onderhoud)) data.onderhoud = [];
    if (!Array.isArray(data.vaste_kosten)) data.vaste_kosten = [];
    if (!Array.isArray(data.betalingen)) data.betalingen = [];

    // Repareer geselecteerd: moet wijzen naar een echt bestaande auto.
    const bestaande = new Set((data.autos || []).map((a) => a?.id).filter(Boolean));
    if (!bestaande.has(data.geselecteerd)) {
      data.geselecteerd = data.autos?.[0]?.id ?? null;
    }
    this._db.save(data);
    Utils.toast('Geïmporteerd ✓');
    setTimeout(() => location.reload(), 800);
  }

  _toepassenSamenvoegen(data) {
    const huidig = this._db.load();

    const mergeArr = (oud, nieuw) => {
      if (!Array.isArray(nieuw)) return oud || [];
      const aanwezig = new Set((oud || []).map((x) => x?.id).filter(Boolean));
      const samen = [...(oud || [])];
      nieuw.forEach((n) => {
        if (!n) return;
        if (n.id && aanwezig.has(n.id)) return;
        samen.push(n);
      });
      return samen;
    };

    huidig.autos = mergeArr(huidig.autos, data.autos);
    huidig.ritten = mergeArr(huidig.ritten, data.ritten);
    huidig.tankbeurten = mergeArr(huidig.tankbeurten, data.tankbeurten);
    huidig.onderhoud = mergeArr(huidig.onderhoud, data.onderhoud);
    huidig.vaste_kosten = mergeArr(huidig.vaste_kosten, data.vaste_kosten);
    huidig.betalingen = mergeArr(huidig.betalingen, data.betalingen);

    if (!huidig.geselecteerd && huidig.autos.length) huidig.geselecteerd = huidig.autos[0].id;

    // Items met onbekend auto_id krijgen het huidige geselecteerd
    // — voorkomt orphans die anders in geen enkele auto-view verschijnen.
    const bestaande = new Set(huidig.autos.map((a) => a.id));
    const fallback = bestaande.has(huidig.geselecteerd) ? huidig.geselecteerd : (huidig.autos[0]?.id ?? null);
    const fix = (lijst) => (lijst || []).map((it) => {
      if (!it || typeof it !== 'object') return it;
      if (!bestaande.has(it.auto_id)) return { ...it, auto_id: fallback };
      return it;
    });
    huidig.ritten = fix(huidig.ritten);
    huidig.tankbeurten = fix(huidig.tankbeurten);
    huidig.onderhoud = fix(huidig.onderhoud);
    huidig.vaste_kosten = fix(huidig.vaste_kosten);
    huidig.betalingen = fix(huidig.betalingen);

    this._db.save(huidig);
    Utils.toast('Samengevoegd ✓');
    setTimeout(() => location.reload(), 800);
  }

  /**
   * Accepteer v1- (autokosten_v1), v2- en v3-export-files. Geeft een v3-shape
   * terug, of `null` als de input niet herkend wordt.
   */
  _normaliseerImport(raw) {
    if (!raw || typeof raw !== 'object') return null;

    // v3 / v2: heeft expliciete autos-array
    if (Array.isArray(raw.autos)) {
      if (!Array.isArray(raw.ritten)) return null;
      if (!Array.isArray(raw.tankbeurten)) return null;
      return raw;
    }

    // v1: instellingen + losse ritten/tankbeurten zonder autos
    if (raw.instellingen && (Array.isArray(raw.ritten) || Array.isArray(raw.tankbeurten))) {
      const autoId = crypto.randomUUID();
      const auto = {
        id: autoId,
        naam: raw.naam || 'Mijn auto',
        merk: '',
        km_per_liter: Number(raw.instellingen.km_per_liter) || 14,
        prijs_per_liter: Number(raw.instellingen.prijs_per_liter) || 2.10,
        emoji: '🚗',
      };
      return {
        versie: 3,
        thema: 'auto',
        naam: raw.naam || '',
        autos: [auto],
        geselecteerd: autoId,
        ritten: (raw.ritten || []).map((r) => ({ ...r, auto_id: autoId })),
        tankbeurten: (raw.tankbeurten || []).map((t) => ({ ...t, auto_id: autoId })),
        onderhoud: [],
        vaste_kosten: [],
        betalingen: [],
        smart_tracking: false,
        betaalverzoek_username: '',
        revolut_username: '',
        tikkie_handle: '',
      };
    }

    return null;
  }
}
