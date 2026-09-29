// @vitest-environment node
// Real-backend test (no mocks) for the visibility setting.
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test -- visibility.live
// It saves a choice under `settings.visibility` and puts the original back (or removes the row if there was none).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { api, ApiError } from '@/api/client';
import { platformContentApi } from '@/api/platformContent';
import { useAuthStore } from '@/store/authStore';
import { ALL_VISIBLE, VISIBILITY_KEY, parseVisibility, serializeVisibility, withLayers, withSection } from './model';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;
let original: string | null = null;

async function readStored(): Promise<string | null> {
  try {
    return (await platformContentApi.get(VISIBILITY_KEY)).item?.content_value ?? null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

describe.skipIf(!BASE)('visibility setting against the live backend', () => {
  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(typeof input === 'string' && input.startsWith('/') ? BASE + input : input, init)) as typeof fetch;
    original = await readStored();
    const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
    useAuthStore.getState().setSession(user);
  });
  afterAll(async () => {
    const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
    useAuthStore.getState().setSession(user);
    if (original === null) await api.delete(`/api/admin/platform-content/${VISIBILITY_KEY}`);
    else await platformContentApi.save(VISIBILITY_KEY, 'إظهار وإخفاء الطبقات والأقسام', original);
    useAuthStore.setState({ user: null });
    globalThis.fetch = nativeFetch;
  });

  it('an admin saves a choice and a visitor reads it back through the one-key endpoint', async () => {
    const choice = withSection(withLayers(ALL_VISIBLE, ['plumber', 'rent'], false), 'ticker', false);
    await platformContentApi.save(VISIBILITY_KEY, 'test', serializeVisibility(choice));

    useAuthStore.setState({ user: null }); // a visitor
    const stored = parseVisibility(await readStored());
    expect([...stored.hiddenLayers].sort()).toEqual(['plumber', 'rent']);
    expect([...stored.hiddenSections]).toEqual(['ticker']);
  });

  it('a missing key is a 404, not an error page', async () => {
    await expect(platformContentApi.get('settings.no-such-key')).rejects.toMatchObject({ status: 404 });
  });

  it('a normal user cannot change it', async () => {
    const { user } = await authApi.login({ phone: '0590000003', password: 'User#12345' });
    useAuthStore.getState().setSession(user);
    await expect(platformContentApi.save(VISIBILITY_KEY, 'x', '{}')).rejects.toBeInstanceOf(ApiError);
  });
});
