import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './client';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';

const user = { user_id: 7, role: 'admin', token: 'tok-1', admin_token: 'tok-1', phone: '059' } as AuthUser;

function respond(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status, headers })),
    );
}

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends the bearer token and JSON body, builds the query string without empty values', async () => {
    const f = respond(200, { ok: true });
    vi.stubGlobal('fetch', f);
    await api.post('/api/x', { a: 1 });
    await api.get('/api/y', { q: 'ab', empty: '', none: undefined, n: 0 });
    const [, init] = f.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer tok-1');
    expect(init.body).toBe('{"a":1}');
    expect(f.mock.calls[1][0]).toBe('/api/y?q=ab&n=0');
  });

  it('turns the server error text into ApiError.message and keeps status/code', async () => {
    vi.stubGlobal('fetch', respond(403, { error: 'ممنوع', code: 'NOPE' }));
    await expect(api.get('/api/x')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'ممنوع',
      status: 403,
      code: 'NOPE',
    });
    expect(useAuthStore.getState().user).not.toBeNull(); // 403 is not a dead session
  });

  it('logs out on 401 (dead session)…', async () => {
    vi.stubGlobal('fetch', respond(401, { error: 'x', code: 'SESSION_REVOKED' }));
    await expect(api.get('/api/x')).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem('map_user')).toBeNull();
  });

  it('…but not on 401 from login / verify-session (wrong credentials)', async () => {
    vi.stubGlobal('fetch', respond(401, { message: 'bad creds' }));
    await expect(api.post('/api/auth/login', {})).rejects.toMatchObject({ message: 'bad creds' });
    expect(useAuthStore.getState().user).not.toBeNull();
  });

  it('stores a rotated token from X-New-Token (password change)', async () => {
    vi.stubGlobal('fetch', respond(200, { status: 'success' }, { 'X-New-Token': 'tok-2' }));
    await api.post('/api/auth/change-password', {});
    expect(useAuthStore.getState().user?.token).toBe('tok-2');
    expect(useAuthStore.getState().user?.admin_token).toBe('tok-2');
    expect(JSON.parse(localStorage.getItem('map_user')!).token).toBe('tok-2');
  });

  it('maps a network failure to ApiError status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    await expect(api.get('/api/x')).rejects.toMatchObject({ status: 0 });
  });
});
