// ── Utils ────────────────────────────────────────────────────────────────────
export class Utils {
  static uid() {
    return crypto.randomUUID();
  }

  /** Haversine afstand in km tussen twee {lat,lng} punten */
  static haversine(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2
      + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  /** Bereken saldo: tegoed (tankbeurten) minus verschuldigd (ritten) */
  static berekenSaldo(ritten, tankbeurten, auto) {
    const gereden = ritten.reduce((s, r) => s + (r.km ?? 0), 0);
    const betaald = tankbeurten.reduce((s, t) => s + (t.totaal ?? 0), 0);
    let verschuldigd;
    if (auto.type === 'elektrisch') {
      verschuldigd = (gereden / 100) * (auto.kwh_per_100km || 15) * (auto.prijs_per_kwh || 0.25);
    } else {
      verschuldigd = (gereden / (auto.km_per_liter || 14)) * (auto.prijs_per_liter || 2.10);
    }
    return { saldo: betaald - verschuldigd, betaald, verschuldigd, gereden };
  }

  static eur(v) {
    return '€ ' + Math.abs(v).toFixed(2).replace('.', ',');
  }

  static km(v) {
    return v.toFixed(1).replace('.', ',') + ' km';
  }

  static datumStr(iso) {
    return new Date(iso).toLocaleString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  static begroeting() {
    const h = new Date().getHours();
    return h < 12 ? 'GOEDEMORGEN' : h < 18 ? 'GOEDEMIDDAG' : 'GOEDENAVOND';
  }

  static wacht(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Escape HTML special characters to prevent XSS */
  static esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Voeg swipe-naar-beneden-sluiten toe aan een bottom-sheet panel.
   * @param {HTMLElement} panelEl  Het scrollbare sheet-element
   * @param {() => void} onDismiss Wordt aangeroepen na de sluit-animatie
   * @param {number} threshold     Minimale drag in px om te triggeren (standaard 80)
   */
  static bindSwipeToDismiss(panelEl, onDismiss, threshold = 80) {
    let startY = 0;
    let dragging = false;
    let moved = 0;

    panelEl.addEventListener('touchstart', (e) => {
      if (panelEl.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      dragging = true;
      moved = 0;
    }, { passive: true });

    panelEl.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { dragging = false; return; }
      moved = dy;
      panelEl.style.transition = 'none';
      panelEl.style.transform = `translateY(${dy}px)`;
      e.preventDefault();
    }, { passive: false });

    panelEl.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      if (moved >= threshold) {
        panelEl.style.transition = 'transform 0.26s cubic-bezier(0.4, 0, 1, 1)';
        panelEl.style.transform = 'translateY(100%)';
        setTimeout(() => {
          panelEl.style.transition = '';
          panelEl.style.transform = '';
          onDismiss();
        }, 260);
      } else {
        panelEl.style.transition = '';
        panelEl.style.transform = '';
      }
    }, { passive: true });
  }

  /** Show a small in-app toast notification (replaces browser alert) */
  static toast(tekst, type = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = tekst;
    document.body.appendChild(el);
    // Double rAF ensures CSS transition fires after paint
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast-in')));
    setTimeout(() => {
      el.classList.remove('toast-in');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, 2400);
  }

  // ── v3-toevoegingen ─────────────────────────────────────────────────────────

  /**
   * Bind swipe-naar-links-om-te-verwijderen aan een <li>. Geen extra markup
   * nodig — het li-element zelf wordt horizontaal versleept. Bij overschrijding
   * van threshold animeert de li van scherm en wordt onDelete() aangeroepen.
   * @param {HTMLElement} liEl
   * @param {() => void} onDelete
   * @param {number} threshold  drag-px om te triggeren (standaard 90)
   */
  static bindSwipeToDelete(liEl, onDelete, threshold = 90) {
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let lockedAxis = null; // 'x' | 'y' | null
    let dx = 0;

    liEl.style.touchAction = 'pan-y';

    const reset = () => {
      liEl.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
      liEl.style.transform = '';
      liEl.style.opacity = '';
      setTimeout(() => { liEl.style.transition = ''; }, 220);
    };

    liEl.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragging = true;
      lockedAxis = null;
      dx = 0;
      liEl.style.transition = 'none';
    }, { passive: true });

    liEl.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dxRaw = e.touches[0].clientX - startX;
      const dyRaw = e.touches[0].clientY - startY;

      if (!lockedAxis) {
        if (Math.abs(dxRaw) > 8 || Math.abs(dyRaw) > 8) {
          lockedAxis = Math.abs(dxRaw) > Math.abs(dyRaw) ? 'x' : 'y';
        } else {
          return;
        }
      }
      if (lockedAxis !== 'x') return;
      if (dxRaw > 0) { dx = 0; liEl.style.transform = ''; liEl.style.opacity = ''; return; }
      dx = dxRaw;
      const opacity = Math.max(0.4, 1 - Math.min(1, Math.abs(dx) / 200));
      liEl.style.transform = `translateX(${dx}px)`;
      liEl.style.opacity = String(opacity);
    }, { passive: true });

    liEl.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      if (lockedAxis === 'x' && dx <= -threshold) {
        const breedte = liEl.offsetWidth || 320;
        liEl.style.transition = 'transform 0.22s ease-in, opacity 0.22s ease-in';
        liEl.style.transform = `translateX(-${breedte}px)`;
        liEl.style.opacity = '0';
        setTimeout(() => onDelete(), 200);
      } else {
        reset();
      }
    });

    liEl.addEventListener('touchcancel', reset);
  }

  /**
   * Toon een undo-toast onderin het scherm. Auto-dismisst na `ms` ms en
   * roept dan onTimeout() aan (commit). Bij klik op undo → onUndo() + dismiss.
   * @param {string} tekst
   * @param {() => void} onUndo
   * @param {() => void} [onTimeout]
   * @param {number} [ms=5000]
   */
  static undoToast(tekst, onUndo, onTimeout, ms = 5000) {
    // Verwijder een eventuele eerdere undo-toast (snel achter elkaar verwijderen)
    document.querySelectorAll('.item-undo-toast').forEach((t) => t.remove());

    const wrap = document.createElement('div');
    wrap.className = 'item-undo-toast';
    wrap.innerHTML = `
      <span class="item-undo-toast-tekst"></span>
      <button type="button" class="item-undo-toast-btn">Ongedaan maken</button>
    `;
    wrap.querySelector('.item-undo-toast-tekst').textContent = tekst;
    document.body.appendChild(wrap);

    let opgelost = false;
    const sluit = () => {
      if (opgelost) return;
      opgelost = true;
      wrap.classList.add('uit');
      setTimeout(() => wrap.remove(), 220);
    };

    const timer = setTimeout(() => {
      sluit();
      if (typeof onTimeout === 'function') onTimeout();
    }, ms);

    wrap.querySelector('.item-undo-toast-btn').addEventListener('click', () => {
      clearTimeout(timer);
      sluit();
      if (typeof onUndo === 'function') onUndo();
    });
  }

  /**
   * Verklein een afbeelding-File tot een JPEG base64 dataURL ≤ 200 KB.
   * Langste zijde wordt teruggebracht tot maximaal 1280px. Probeert achtereenvolgens
   * kwaliteit 0.75, 0.55 en 0.4. Geeft null terug als het bestand geen afbeelding is
   * of als het na drie pogingen nog te groot is (toont dan ook een fout-toast).
   */
  static async formatBon(file) {
    // Geen afbeelding? Direct null.
    if (!file || typeof file !== 'object' || !file.type || !file.type.startsWith('image/')) {
      return null;
    }

    const MAX_EDGE = 1280;
    const MAX_CHARS = 200_000;
    const KWALITEITEN = [0.75, 0.55, 0.4];

    // Laad de bitmap — modern via createImageBitmap, fallback via <img> voor Safari.
    let breedte = 0;
    let hoogte = 0;
    let bron = null;
    try {
      if (typeof createImageBitmap === 'function') {
        bron = await createImageBitmap(file);
        breedte = bron.width;
        hoogte = bron.height;
      } else {
        throw new Error('createImageBitmap ontbreekt');
      }
    } catch (_e) {
      // Fallback: laad via <img> en object-URL.
      const url = URL.createObjectURL(file);
      try {
        bron = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Afbeelding kon niet geladen worden'));
          img.src = url;
        });
        breedte = bron.naturalWidth || bron.width;
        hoogte = bron.naturalHeight || bron.height;
      } catch (_err) {
        URL.revokeObjectURL(url);
        return null;
      }
      // Object-URL pas vrijgeven na drawImage; dat doen we hieronder.
      // We bewaren de URL zodat we 'm later kunnen revoken.
      bron.__objectUrl = url;
    }

    if (!breedte || !hoogte) {
      if (bron && bron.__objectUrl) URL.revokeObjectURL(bron.__objectUrl);
      return null;
    }

    // Bepaal schaal zodat langste zijde ≤ MAX_EDGE.
    const langste = Math.max(breedte, hoogte);
    const schaal = langste > MAX_EDGE ? MAX_EDGE / langste : 1;
    const doelBreedte = Math.round(breedte * schaal);
    const doelHoogte = Math.round(hoogte * schaal);

    // Hidden canvas in document fragment — niet aan DOM toevoegen.
    const canvas = document.createElement('canvas');
    canvas.width = doelBreedte;
    canvas.height = doelHoogte;
    const ctx = canvas.getContext('2d');
    // Witte achtergrond zodat eventuele transparantie geen zwarte vlakken oplevert.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, doelBreedte, doelHoogte);
    ctx.drawImage(bron, 0, 0, doelBreedte, doelHoogte);

    // Cleanup van object-URL fallback.
    if (bron && bron.__objectUrl) URL.revokeObjectURL(bron.__objectUrl);
    if (typeof bron.close === 'function') bron.close();

    // Probeer afnemende kwaliteiten tot we onder de limiet zitten.
    let resultaat = null;
    for (const q of KWALITEITEN) {
      const dataUrl = canvas.toDataURL('image/jpeg', q);
      if (dataUrl.length <= MAX_CHARS) {
        resultaat = dataUrl;
        break;
      }
    }

    if (!resultaat) {
      Utils.toast('Foto te groot — kies een kleinere foto', 'fout');
      return null;
    }
    return resultaat;
  }

  /**
   * Gemiddeld verbruik in liter per 100 km, berekend over alle ritten en tankbeurten.
   * Retourneert 0 als er geen km of geen liters zijn.
   */
  static km100l(ritten, tankbeurten) {
    const km = (ritten || []).reduce((s, r) => s + (Number(r?.km) || 0), 0);
    const liters = (tankbeurten || []).reduce((s, t) => s + (Number(t?.liters) || 0), 0);
    if (km <= 0 || liters <= 0) return 0;
    return (liters / km) * 100;
  }

  /**
   * Kosten per km in euro: brandstof + pro-rata vaste kosten gedeeld door totaal km.
   * Maandelijkse vaste kosten: bedrag × aantal maanden in periode.
   * Jaarlijkse vaste kosten: bedrag × (aantal maanden / 12).
   * Periode = van oudste rit/tankbeurt tot vandaag, minimaal 1 maand.
   * Retourneert 0 als er geen km zijn.
   */
  static kostenPerKm(ritten, tankbeurten, vasteKosten) {
    const km = (ritten || []).reduce((s, r) => s + (Number(r?.km) || 0), 0);
    if (km <= 0) return 0;

    const brandstofKosten = (tankbeurten || []).reduce((s, t) => s + (Number(t?.totaal) || 0), 0);

    // Zoek de periode (oudste activiteit → vandaag).
    let oudste = null;
    const verzamel = (arr) => {
      for (const it of (arr || [])) {
        const ts = Date.parse(it?.datum);
        if (!Number.isNaN(ts) && (oudste === null || ts < oudste)) oudste = ts;
      }
    };
    verzamel(ritten);
    verzamel(tankbeurten);

    const nu = new Date();
    const periodeStart = oudste !== null ? new Date(oudste) : nu;

    // Som vaste kosten alleen voor de maanden waarin ze actief waren binnen
    // de periode (respecteer start_datum / eind_datum).
    const monthsBetween = (a, b) =>
      Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1);

    const totalePeriodeMnd = Math.max(1, monthsBetween(periodeStart, nu));

    let vasteTotaal = 0;
    for (const vk of (vasteKosten || [])) {
      const bedrag = Number(vk?.bedrag) || 0;
      if (!bedrag) continue;
      const start = vk?.start_datum ? new Date(vk.start_datum) : periodeStart;
      const eind = vk?.eind_datum ? new Date(vk.eind_datum) : nu;
      const actiefVanaf = start > periodeStart ? start : periodeStart;
      const actiefTot = eind < nu ? eind : nu;
      if (actiefVanaf > actiefTot) continue;
      const actieveMnd = Math.max(1, monthsBetween(actiefVanaf, actiefTot));
      if (vk?.frequentie === 'maandelijks') {
        vasteTotaal += bedrag * actieveMnd;
      } else if (vk?.frequentie === 'jaarlijks') {
        vasteTotaal += bedrag * (actieveMnd / 12);
      }
    }
    // (totalePeriodeMnd wordt impliciet gerespecteerd via actieveMnd ≤ totalePeriodeMnd)
    void totalePeriodeMnd;

    return (brandstofKosten + vasteTotaal) / km;
  }

  /**
   * Filter items met een `datum`-veld op periode.
   * 'maand'  → huidige kalendermaand (jaar+maand).
   * 'jaar'   → huidige kalenderjaar.
   * 'alles'  → onveranderd doorgegeven.
   * Items zonder geldig parsebare datum vallen weg bij maand/jaar, blijven bij alles.
   */
  static filterOpPeriode(items, periode) {
    const lijst = items || [];
    if (periode === 'alles') return lijst.slice();
    const nu = new Date();
    const huidigJaar = nu.getFullYear();
    const huidigeMaand = nu.getMonth();
    return lijst.filter((it) => {
      const ts = Date.parse(it?.datum);
      if (Number.isNaN(ts)) return false;
      const d = new Date(ts);
      if (periode === 'maand') {
        return d.getFullYear() === huidigJaar && d.getMonth() === huidigeMaand;
      }
      if (periode === 'jaar') {
        return d.getFullYear() === huidigJaar;
      }
      // Onbekende periode → niets matchen (defensief).
      return false;
    });
  }
}
