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
        if (!Array.isArray(data.autos) || !Array.isArray(data.ritten) || !Array.isArray(data.tankbeurten))
          throw new Error('Ongeldig formaat');
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

    this._db.save(huidig);
    Utils.toast('Samengevoegd ✓');
    setTimeout(() => location.reload(), 800);
  }
}
