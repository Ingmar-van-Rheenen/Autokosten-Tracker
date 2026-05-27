// ── ApiClient ─────────────────────────────────────────────────────────────────
// Dunne wrapper rond fetch() voor de Vroom-API. Doet credentials, JSON-encoding,
// foutafhandeling en netwerk-detectie. Wordt in komende sprints aangesloten;
// nog niet gebruikt door de app-flow.
//
// Auth = sessie-cookies (HttpOnly, gezet door /auth/callback). De client hoeft
// dus geen token bij te houden — `credentials: 'include'` is genoeg.

const DEFAULT_BASE_URL = (() => {
  const h = typeof location !== 'undefined' ? location.hostname : '';
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3001';
  if (h === 'auto.ingmarvanrheenen.nl') return 'https://vroom-api.ingmarvanrheenen.nl';
  return 'https://vroom-api.ingmarvanrheenen.nl';
})();

export class ApiError extends Error {
  constructor(status, code, message, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export class ApiClient {
  /**
   * @param {object} [opts]
   * @param {string} [opts.baseUrl] - override API-basis-URL
   */
  constructor(opts = {}) {
    this.baseUrl = opts.baseUrl || DEFAULT_BASE_URL;
  }

  // ── Lage-niveau request ─────────────────────────────────────────────────────

  /**
   * @param {string} path - bv. '/me'
   * @param {object} [init] - fetch-init met optionele JSON `body`
   * @returns {Promise<any>}
   */
  async request(path, init = {}) {
    const url = this.baseUrl + path;
    const headers = { ...(init.headers || {}) };
    let body = init.body;
    if (body !== undefined && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(url, {
        method: init.method || 'GET',
        headers,
        body,
        credentials: 'include',
        cache: 'no-store',
      });
    } catch (e) {
      throw new ApiError(0, 'network_error', e?.message || 'Netwerkfout');
    }

    const tekst = await res.text();
    const data = tekst ? this._parseSafe(tekst) : null;

    if (!res.ok) {
      const code = data?.error?.code || `http_${res.status}`;
      const msg = data?.error?.message || `HTTP ${res.status}`;
      throw new ApiError(res.status, code, msg, data);
    }
    return data;
  }

  _parseSafe(s) {
    try { return JSON.parse(s); } catch { return s; }
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  vraagMagicLink(email) {
    return this.request('/auth/magic-link', { method: 'POST', body: { email } });
  }

  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  me() {
    return this.request('/me');
  }

  // ── Groepen ─────────────────────────────────────────────────────────────────

  mijnGroepen() { return this.request('/groepen'); }
  maakGroep(naam, type) { return this.request('/groepen', { method: 'POST', body: { naam, type } }); }
  groepDetail(id) { return this.request(`/groepen/${id}`); }

  maakInvite(groepId, email) {
    return this.request(`/groepen/${groepId}/invites`, {
      method: 'POST',
      body: email ? { email } : {},
    });
  }
  bekijkInvite(code) { return this.request(`/invites/${code}`); }
  accepteerInvite(code) { return this.request(`/invites/${code}/accept`, { method: 'POST' }); }

  // ── Sync ────────────────────────────────────────────────────────────────────

  pull(since) {
    return this.request('/sync/pull', { method: 'POST', body: since ? { since } : {} });
  }
  push(payload) {
    return this.request('/sync/push', { method: 'POST', body: payload });
  }

  // ── Status ──────────────────────────────────────────────────────────────────

  /** Lichte gezondheids-check; throwt niet, geeft true/false terug. */
  async beschikbaar() {
    try {
      await this.request('/health');
      return true;
    } catch { return false; }
  }
}

/** Default-instantie voor consumers die geen eigen instellingen nodig hebben. */
export const api = new ApiClient();
