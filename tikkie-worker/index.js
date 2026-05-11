// Cloudflare Worker — Tikkie betaalverzoek proxy
// Deploy via: wrangler deploy

const TIKKIE_PROD    = 'https://api.abnamro.com/v2/tikkie/paymentrequests';
const TIKKIE_SANDBOX = 'https://api-sandbox.abnamro.com/v2/tikkie/paymentrequests';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Tikkie-Key, X-Tikkie-App-Token, X-Tikkie-Sandbox',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    const apiKey = request.headers.get('X-Tikkie-Key');
    const appToken = request.headers.get('X-Tikkie-App-Token');
    if (!apiKey || !appToken) {
      return new Response('Geen API-sleutel of App Token', { status: 401, headers: CORS });
    }

    const sandbox = request.headers.get('X-Tikkie-Sandbox') === 'true';
    const tikkieUrl = sandbox ? TIKKIE_SANDBOX : TIKKIE_PROD;

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: CORS });
    }

    const { amountInCents, description } = body;
    if (!amountInCents || !description) {
      return new Response('amountInCents en description zijn verplicht', { status: 400, headers: CORS });
    }

    const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const resp = await fetch(tikkieUrl, {
      method: 'POST',
      headers: {
        'API-Key': apiKey,
        'X-App-Token': appToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amountInCents, description, expiryDate }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return new Response(JSON.stringify({
        tikkieStatus: resp.status,
        tikkieError: data,
        debug: { urlCalled: tikkieUrl, keyLength: apiKey.length, appTokenLength: appToken.length },
      }), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    return new Response(JSON.stringify({ url: data.url }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  },
};
