import { toast } from '@/components/ui/toastStore';
import { useAuthStore } from '@/store/authStore';

/** Error thrown for every failed request; `message` is the server's (Arabic) text when it sent one. */
export class ApiError extends Error {
  status: number;
  code?: string;
  data: unknown;
  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** Paths whose 401 means "wrong credentials", not "session dead" (same list as legacy auth-fetch.js). */
const NO_LOGOUT_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/verify-session'];

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

function buildUrl(path: string, query?: Query) {
  if (!query) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

function pickMessage(data: unknown, fallback: string) {
  if (data && typeof data === 'object') {
    const d = data as { error?: unknown; message?: unknown };
    if (typeof d.error === 'string') return d.error;
    if (typeof d.message === 'string') return d.message;
  }
  return fallback;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, headers = {} } = opts;
  const token = useAuthStore.getState().user?.token;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const init: RequestInit = {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  };

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), init);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError('network', 0);
  }

  // Password change rotates the token; keep the session alive with the new one.
  const renewed = res.headers.get('X-New-Token');
  if (renewed) useAuthStore.getState().replaceToken(renewed);

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    // A request that brings its own credentials (or the admin's read-only view token) says nothing about the app session.
    const ownCredentials = 'Authorization' in headers || 'X-Read-Only-View' in headers;
    // The session ended (expired, logged out elsewhere, deactivated, password or role changed): out, and say why.
    if (res.status === 401 && token && !ownCredentials && !NO_LOGOUT_PATHS.includes(path) && useAuthStore.getState().user) {
      useAuthStore.getState().logout();
      // i18n is loaded lazily: it touches `document`, and this module also runs in the node (live) tests
      void import('@/i18n').then(({ default: i18n }) => toast.warning(i18n.t('auth.sessionEnded')));
    }
    const code = data && typeof data === 'object' ? (data as { code?: string }).code : undefined;
    throw new ApiError(pickMessage(data, res.statusText || `HTTP ${res.status}`), res.status, code, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query, opts?: Omit<RequestOptions, 'method' | 'body' | 'query'>) =>
    apiRequest<T>(path, { ...opts, method: 'GET', query }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(path, { ...opts, method: 'DELETE' }),
};
