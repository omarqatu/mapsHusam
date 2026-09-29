import { useAuthStore } from '@/store/authStore';
import type { FeatureTx, SaveResult } from './tx';
import { buildTransactionXml, parseTransactionResponse } from './wfst';

// THE ONLY FILE THAT KNOWS HOW A CHANGE REACHES THE DATABASE.
//
// Today: a WFS-T transaction posted through the backend's GeoServer proxy, authenticated with the GeoServer login the
// admin typed for this one save (legacy behaviour). To move the write to a server endpoint (see PLAN.md → Backend
// asks) only `saveFeature` changes: post `tx` as JSON through `api/client.ts` and drop `credentials`. The editor UI
// builds a `FeatureTx` and awaits a `SaveResult`; it never sees XML, headers or the proxy path.

/** The proxy path. Workspace-less on purpose: the transaction names its own layer, and the server whitelists it. */
const ENDPOINT = '/geoserver-proxy/wfs';
const TIMEOUT_MS = 60_000;

/** Whether the UI must collect a GeoServer login before calling `saveFeature`. False once a server endpoint takes over. */
export const TRANSPORT_NEEDS_CREDENTIALS = true;

/** `Authorization: Basic` value; UTF-8 so a password with non-Latin characters does not throw in `btoa`. */
function basicAuth({ username, password }: { username: string; password: string }): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

const EXPECTED_COUNT = { insert: 'inserted', update: 'updated', delete: 'deleted' } as const;

/** Writes one change. Never throws for a failed write: the reason comes back as data so the dialog can stay open. */
export async function saveFeature(tx: FeatureTx): Promise<SaveResult> {
  if (TRANSPORT_NEEDS_CREDENTIALS && !tx.credentials) return { ok: false, reason: 'auth' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'text/xml' };
    if (tx.credentials) headers.Authorization = basicAuth(tx.credentials);
    // The proxy lets only admins write; the app token rides in its own header because Authorization holds the
    // GeoServer login. The server strips it before forwarding.
    const appToken = useAuthStore.getState().user?.token;
    if (appToken) headers['X-App-Token'] = appToken;
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: buildTransactionXml(tx),
      credentials: 'omit', // no cookies to GeoServer; the login travels in the header, for this request only
      signal: controller.signal,
    });
    if (res.status === 401) return { ok: false, reason: 'auth' };

    const text = await res.text();
    if (!res.ok && !text.trimStart().startsWith('<'))
      return { ok: false, reason: 'rejected', message: `HTTP ${res.status}` };

    const outcome = parseTransactionResponse(text);
    if (outcome.kind === 'exception') {
      const message = outcome.message || `HTTP ${res.status}`;
      return { ok: false, reason: 'rejected', message };
    }
    if (outcome[EXPECTED_COUNT[tx.op]] < 1)
      return { ok: false, reason: 'rejected', message: `0 features ${EXPECTED_COUNT[tx.op]}` };
    return { ok: true, fid: outcome.fid };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
