// GeoServer reads (WFS GeoJSON) through the backend proxy. Kept apart from client.ts on purpose: the app JWT
// must NOT be sent to GeoServer (legacy auth-fetch.js only attached it to /api/*). An admin's token goes in
// X-App-Token, which the proxy reads (an admin also sees withdrawn and hidden listings) and strips before GeoServer.
import { useAuthStore } from '@/store/authStore';

const PROXY = '/geoserver-proxy';

export interface WfsQuery {
  workspace: string;
  typeName: string;
  srsName: string;
  /** [minX, minY, maxX, maxY] in `srsName`. */
  bbox?: readonly number[];
  maxFeatures?: number;
}

/** Workspace endpoint first; legacy retried the global `/ows` endpoint when that failed. */
export function wfsUrls(q: WfsQuery): [string, string] {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '1.0.0',
    request: 'GetFeature',
    typeName: `${q.workspace}:${q.typeName}`,
    outputFormat: 'application/json',
    srsName: q.srsName,
  });
  if (q.bbox) params.set('bbox', `${q.bbox.join(',')},${q.srsName}`);
  if (q.maxFeatures) params.set('maxFeatures', String(q.maxFeatures));
  const qs = params.toString();
  return [`${PROXY}/${q.workspace}/ows?${qs}`, `${PROXY}/ows?${qs}`];
}

export class GeoServerError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GeoServerError';
    this.status = status;
  }
}

function adminHeader(): Record<string, string> {
  const user = useAuthStore.getState().user;
  return user?.role === 'admin' && user.token ? { 'X-App-Token': user.token } : {};
}

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    signal,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...adminHeader() },
  });
  const text = await res.text();
  if (!res.ok) throw new GeoServerError(`HTTP ${res.status}`, res.status);
  try {
    return JSON.parse(text);
  } catch {
    // GeoServer answers errors as XML with status 200.
    throw new GeoServerError('not JSON (GeoServer exception report?)', res.status);
  }
}

/** GeoJSON FeatureCollection for a WFS query, with a timeout and the legacy fallback endpoint. */
export async function fetchWfs(
  q: WfsQuery,
  opts: { timeoutMs: number; signal?: AbortSignal },
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);
  try {
    const [primary, fallback] = wfsUrls(q);
    try {
      return await getJson(primary, controller.signal);
    } catch (e) {
      if (controller.signal.aborted) throw e;
      return await getJson(fallback, controller.signal);
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}
