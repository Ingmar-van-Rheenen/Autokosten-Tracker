# Vroom

Mobiele PWA voor het bijhouden van autoritten, tankbeurten en kosten. Gebouwd voor persoonlijk gebruik: het bijhouden van kosten bij het rijden met de auto van je ouders.

Vroom heette eerder Tanklog. Sommige interne sleutels (oude localStorage-namen, historische migratie-paden) dragen die naam nog en blijven dat houden voor backwards-compatibility.

## Wat het doet

- Rit loggen via GPS (start/stop, km automatisch berekend via OSRM)
- Tankbeurten bijhouden
- Live saldo: hoeveel je nog verschuldigd bent of al hebt bijgedragen
- Kosten verdelen via WhatsApp of Revolut
- Meerdere auto's beheren

## Stack

- Vanilla HTML / CSS / JS — geen framework, geen bundler
- Leaflet 1.9.4 voor kaartweergave
- OSRM voor routeberekening (geen API key nodig)
- localStorage voor opslag (`vroom_v1`, migreert van `tanklog_v3`/`v2`/`autokosten_v1`)
- Service Worker voor PWA offline support

## Installeren

Geen installatie nodig. Open `index.html` in een browser of via een lokale server.

Voor GPS-toegang moet de app via HTTPS of `localhost` worden geserveerd.

```bash
npx serve .
```

## Deployment

Statische bestanden — deploy direct naar GitHub Pages, Netlify of Vercel.
