// @vitest-environment node
// Real-backend test (no mocks) for replacing a legal text.
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test -- overrides.live
// It replaces `legal.about` and puts the original back (or removes the row if there was none).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';
import { platformContentApi } from '@/api/platformContent';
import { useAuthStore } from '@/store/authStore';
import { fetchOverride, overrideKey, serializeOverride } from './overrides';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;
const KEY = overrideKey('about');
let original: { label: string; value: string } | null = null;

const asAdmin = async () => {
  const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
  useAuthStore.getState().setSession(user);
};

describe.skipIf(!BASE)('legal text replacement against the live backend', () => {
  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(typeof input === 'string' && input.startsWith('/') ? BASE + input : input, init)) as typeof fetch;
    const item = (await platformContentApi.get(KEY)).item;
    original = item ? { label: item.label, value: item.content_value } : null;
    await asAdmin();
  });
  afterAll(async () => {
    await asAdmin();
    if (original) await platformContentApi.save(KEY, original.label, original.value);
    else await platformContentApi.remove(KEY);
    useAuthStore.setState({ user: null });
    globalThis.fetch = nativeFetch;
  });

  it('an admin saves a replacement; a visitor gets it; restoring the default removes it', async () => {
    await platformContentApi.save(KEY, 'test', serializeOverride({ title: 'T', html: '<p>live</p>' }));
    useAuthStore.setState({ user: null });
    expect(await fetchOverride(KEY)).toEqual({ title: 'T', html: '<p>live</p>' });

    await asAdmin();
    await platformContentApi.remove(KEY);
    expect(await fetchOverride(KEY)).toBeNull();
  });

  it('a normal user cannot replace a text', async () => {
    const { user } = await authApi.login({ phone: '0590000003', password: 'User#12345' });
    useAuthStore.getState().setSession(user);
    await expect(platformContentApi.save(KEY, 'x', serializeOverride({ title: 'x', html: '<p>x</p>' }))).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
