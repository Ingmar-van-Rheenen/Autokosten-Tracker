// ── Tanklog testdata-seeder ───────────────────────────────────────────────────
// Plak dit hele bestand in de browser-console terwijl Tanklog open staat
// (of voer het uit via DevTools → Snippets). Het script:
//   • wist bestaande localStorage tanklog_v3
//   • zet 2 auto's neer (1 benzine, 1 EV)
//   • genereert ~6 maanden ritten, tankbeurten, onderhoud, vaste kosten en
//     betalingen met enigszins realistische spreiding
//   • herlaadt de pagina zodat de app de nieuwe data inleest
//
// Aantal-knoppen onderaan kun je naar smaak aanpassen.
// ──────────────────────────────────────────────────────────────────────────────

(function seedTanklog() {
  const KEY = 'tanklog_v3';

  // ── Helpers ────────────────────────────────────────────────────────────────
  const uid = () =>
    'id-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 9);

  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (arr) => arr[randInt(0, arr.length - 1)];

  // Datum N dagen terug, optioneel met willekeurig uur
  const dagenTerug = (n, uur = null) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    if (uur != null) d.setHours(uur, randInt(0, 59), 0, 0);
    else d.setHours(randInt(7, 21), randInt(0, 59), 0, 0);
    return d.toISOString();
  };

  // Coördinaten rond Nederland (Utrecht/A'dam/R'dam/Eindhoven)
  const NL_PLEKKEN = [
    { naam: 'Utrecht',     lat: 52.0907, lng: 5.1214 },
    { naam: 'Amsterdam',   lat: 52.3676, lng: 4.9041 },
    { naam: 'Rotterdam',   lat: 51.9244, lng: 4.4777 },
    { naam: 'Eindhoven',   lat: 51.4416, lng: 5.4697 },
    { naam: 'Den Haag',    lat: 52.0705, lng: 4.3007 },
    { naam: 'Groningen',   lat: 53.2194, lng: 6.5665 },
    { naam: 'Nijmegen',    lat: 51.8126, lng: 5.8372 },
    { naam: 'Arnhem',      lat: 51.9851, lng: 5.8987 },
    { naam: 'Tilburg',     lat: 51.5555, lng: 5.0913 },
    { naam: 'Breda',       lat: 51.5719, lng: 4.7683 },
  ];

  // Hemelsbrede afstand × 1.25 wegfactor, geeft km
  const haversineKm = (a, b) => {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const sa =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * Math.PI / 180) *
      Math.cos(b.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa)) * 1.25;
  };

  // ── Auto's ─────────────────────────────────────────────────────────────────
  const autoBenzine = {
    id: uid(),
    naam: 'Auto van Mama',
    merk: 'Volkswagen Polo',
    type: 'benzine',
    km_per_liter: 14.5,
    prijs_per_liter: 2.10,
    emoji: '🚗',
    passagiers: ['Mama', 'Papa', 'Sophie'],
  };

  const autoEV = {
    id: uid(),
    naam: 'Tesla',
    merk: 'Tesla Model 3',
    type: 'elektrisch',
    km_per_kwh: 6.2,
    prijs_per_kwh: 0.38,
    emoji: '⚡',
    passagiers: ['Lisa', 'Tom'],
  };

  const autos = [autoBenzine, autoEV];

  // ── Genereer ritten ────────────────────────────────────────────────────────
  const ritten = [];
  const aantalRitten = 60; // ~10 per maand
  for (let i = 0; i < aantalRitten; i++) {
    const auto = pick(autos);
    const start = pick(NL_PLEKKEN);
    let eind = pick(NL_PLEKKEN);
    while (eind === start) eind = pick(NL_PLEKKEN);
    const km = +haversineKm(start, eind).toFixed(1);
    ritten.push({
      id: uid(),
      auto_id: auto.id,
      datum: dagenTerug(randInt(1, 180)),
      start: { lat: start.lat, lng: start.lng, naam: start.naam },
      eind:  { lat: eind.lat,  lng: eind.lng,  naam: eind.naam  },
      km,
      bestemming: eind.naam,
      notitie: Math.random() < 0.25 ? pick([
        'Boodschappen', 'Werk', 'Verjaardag', 'Familiebezoek', 'Sport',
      ]) : null,
      km_stand: null,
      gps_track: null,
    });
  }
  ritten.sort((a, b) => new Date(b.datum) - new Date(a.datum));

  // ── Genereer tankbeurten ───────────────────────────────────────────────────
  const tankbeurten = [];
  // Benzine: 1× per ~2 weken, 30-45L
  for (let i = 0; i < 12; i++) {
    const liters = +rand(28, 46).toFixed(2);
    const prijs = +rand(1.95, 2.18).toFixed(3);
    tankbeurten.push({
      id: uid(),
      auto_id: autoBenzine.id,
      datum: dagenTerug(i * 14 + randInt(0, 6)),
      liters,
      prijs_per_liter: prijs,
      prijs_per_kwh: null,
      totaal: +(liters * prijs).toFixed(2),
      bon_foto: null,
      km_stand: null,
      notitie: null,
    });
  }
  // EV: laadbeurten 1× per week, 30-60 kWh
  for (let i = 0; i < 20; i++) {
    const kwh = +rand(25, 65).toFixed(2);
    const prijs = +rand(0.32, 0.59).toFixed(3);
    tankbeurten.push({
      id: uid(),
      auto_id: autoEV.id,
      datum: dagenTerug(i * 8 + randInt(0, 4)),
      liters: kwh,
      prijs_per_liter: 0,
      prijs_per_kwh: prijs,
      totaal: +(kwh * prijs).toFixed(2),
      bon_foto: null,
      km_stand: null,
      notitie: null,
    });
  }
  tankbeurten.sort((a, b) => new Date(b.datum) - new Date(a.datum));

  // ── Onderhoud ──────────────────────────────────────────────────────────────
  const onderhoud = [
    {
      id: uid(), auto_id: autoBenzine.id, datum: dagenTerug(45),
      type: 'apk', kosten: 89.50, opmerking: 'APK + kleine beurt',
    },
    {
      id: uid(), auto_id: autoBenzine.id, datum: dagenTerug(120),
      type: 'banden', kosten: 320.00, opmerking: 'Zomerbanden',
    },
    {
      id: uid(), auto_id: autoEV.id, datum: dagenTerug(70),
      type: 'overig', kosten: 145.00, opmerking: 'Ruitenwissers + softwareservice',
    },
  ];

  // ── Vaste kosten ───────────────────────────────────────────────────────────
  const vaste_kosten = [
    {
      id: uid(), auto_id: autoBenzine.id, type: 'verzekering',
      label: 'WA + casco', bedrag: 58.40, frequentie: 'maandelijks',
      start_datum: dagenTerug(180), eind_datum: null, notitie: null,
    },
    {
      id: uid(), auto_id: autoBenzine.id, type: 'wegenbelasting',
      label: 'MRB Q', bedrag: 132.00, frequentie: 'jaarlijks',
      start_datum: dagenTerug(200), eind_datum: null, notitie: null,
    },
    {
      id: uid(), auto_id: autoEV.id, type: 'verzekering',
      label: 'Allrisk', bedrag: 72.00, frequentie: 'maandelijks',
      start_datum: dagenTerug(160), eind_datum: null, notitie: null,
    },
    {
      id: uid(), auto_id: autoEV.id, type: 'abonnement',
      label: 'Laadpas', bedrag: 4.95, frequentie: 'maandelijks',
      start_datum: dagenTerug(160), eind_datum: null, notitie: null,
    },
  ];

  // ── Betalingen ─────────────────────────────────────────────────────────────
  const betalingen = [
    {
      id: uid(), auto_id: autoBenzine.id, datum: dagenTerug(30),
      bedrag: 50.00, van: 'Ingmar', naar: 'Mama',
      methode: 'tikkie', notitie: 'Afrekening april',
    },
    {
      id: uid(), auto_id: autoBenzine.id, datum: dagenTerug(90),
      bedrag: 75.00, van: 'Ingmar', naar: 'Mama',
      methode: 'overschrijving', notitie: 'Afrekening februari',
    },
  ];

  // ── Schrijf naar localStorage ──────────────────────────────────────────────
  const data = {
    versie: 3,
    thema: 'klassiek',
    naam: 'Ingmar',
    autos,
    geselecteerd: autoBenzine.id,
    ritten,
    tankbeurten,
    onderhoud,
    vaste_kosten,
    betalingen,
    smart_tracking: false,
    betaalverzoek_username: '',
    revolut_username: 'ingmar',
    tikkie_handle: '',
  };

  localStorage.setItem(KEY, JSON.stringify(data));
  // Oudere versies opruimen zodat migratie niet alsnog overschrijft.
  localStorage.removeItem('tanklog_v2');
  localStorage.removeItem('autokosten_v1');
  localStorage.removeItem('tanklog_lopende_rit');

  console.log('[Tanklog] testdata gezaaid:', {
    autos: autos.length,
    ritten: ritten.length,
    tankbeurten: tankbeurten.length,
    onderhoud: onderhoud.length,
    vaste_kosten: vaste_kosten.length,
    betalingen: betalingen.length,
  });
  console.log('[Tanklog] pagina herlaadt over 600ms…');
  setTimeout(() => location.reload(), 600);
})();
