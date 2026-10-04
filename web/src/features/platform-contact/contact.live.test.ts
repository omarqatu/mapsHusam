// @vitest-environment node
// Real-backend test (no mocks) for the platform contact setting.
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test -- contact.live
// It saves `settings.contact` and puts the original back (or removes the row if there was none).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { api } from '@/api/client';
import { platformContentApi } from '@/api/platformContent';
import { useAuthStore } from '@/store/authStore';
import { CONTACT_KEY, parseContact, serializeContact } from './model';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;
let original: { label: string; value: string } | null = null;

const asAdmin = async () => {
  const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
  useAuthStore.getState().setSession(user);
};

describe.skipIf(!BASE)('platform contact against the live backend', () => {
  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
    const item = (await platformContentApi.get(CONTACT_KEY)).item;
    original = item ? { label: item.label, value: item.content_value } : null;
    await asAdmin();
  });
  afterAll(async () => {
    await asAdmin();
    if (original === null) await api.delete(`/api/admin/platform-content/${CONTACT_KEY}`);
    else await platformContentApi.save(CONTACT_KEY, original.label, original.value);
    useAuthStore.setState({ user: null });
    globalThis.fetch = nativeFetch;
  });

  it('an admin saves WhatsApp, phone and a page; a visitor reads them back', async () => {
    const saved = {
      phone: '022951234',
      whatsapp: '0599123456',
      email: 'info@example.com',
      social: { facebook: 'https://www.facebook.com/x', instagram: '', youtube: '', linkedin: '' },
    };
    await platformContentApi.save(CONTACT_KEY, 'Platform contact', serializeContact(saved));
    useAuthStore.setState({ user: null });
    expect(parseContact((await platformContentApi.get(CONTACT_KEY)).item?.content_value)).toEqual(saved);
  });
});
