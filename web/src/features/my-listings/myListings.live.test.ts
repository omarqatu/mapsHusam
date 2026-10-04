// @vitest-environment node
// Real-backend test (no mocks) for "my listings".
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test -- myListings.live
// It edits the dev provider's plumber (seeded) and puts the name, the state and the pictures back afterwards.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth';
import { myListingsApi, type MyListing } from '@/api/myListings';
import { useAuthStore } from '@/store/authStore';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;
// 1×1 transparent PNG
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

const signIn = async (phone: string, password: string) => {
  const { user } = await authApi.login({ phone, password });
  useAuthStore.getState().setSession(user);
};
const asProvider = () => signIn('0590000002', 'Provider#12345');
const find = async (layer: string, id: number) =>
  (await myListingsApi.list()).listings.find((l) => l.layer === layer && l.id === id);

let original: MyListing;

describe.skipIf(!BASE)('my listings against the live backend', () => {
  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
    await asProvider();
    const service = (await myListingsApi.list()).listings.find((l) => l.kind === 'service');
    if (!service) throw new Error('the dev provider owns no service (run dev/dev.sh seed)');
    original = service;
  });
  afterAll(async () => {
    await asProvider();
    await myListingsApi.edit(original, { name: original.name, status: original.status });
    await myListingsApi.setPhotos(original, original.photos);
    useAuthStore.setState({ user: null });
    globalThis.fetch = nativeFetch;
  });

  it('lists the account’s own listings with their state and pictures', async () => {
    const { listings } = await myListingsApi.list();
    expect(listings.length).toBeGreaterThan(0);
    for (const l of listings) {
      expect(['service', 'property']).toContain(l.kind);
      expect([0, 1, 2]).toContain(l.status);
      expect(Array.isArray(l.photos)).toBe(true);
    }
  });

  it('edits the details and the state; bad values are refused', async () => {
    const { listing } = await myListingsApi.edit(original, { name: 'LIVE-TEST سباكة', status: 1 });
    expect(listing).toMatchObject({ name: 'LIVE-TEST سباكة', status: 1 });
    expect((await find(original.layer, original.id))?.name).toBe('LIVE-TEST سباكة');
    await expect(myListingsApi.edit(original, { name: ' ' })).rejects.toMatchObject({ status: 400 });
    await expect(myListingsApi.edit(original, { status: 7 as never })).rejects.toMatchObject({ status: 400 });
    await expect(myListingsApi.edit(original, { phone: '123' })).rejects.toMatchObject({ status: 400 });
  });

  it('uploads a picture to the server’s disk, serves it, and removes it', async () => {
    const { url, photos } = await myListingsApi.upload(original, new Blob([PNG], { type: 'image/png' }));
    expect(url).toMatch(/^\/api\/listing-photos\/[0-9a-f-]{36}\.png$/);
    expect(photos).toContain(url);
    const served = await nativeFetch(BASE + url);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toContain('image/png');

    await expect(
      myListingsApi.upload(original, new Blob(['not an image'], { type: 'image/png' })),
    ).rejects.toMatchObject({ status: 415 });

    const after = await myListingsApi.setPhotos(
      original,
      photos.filter((p) => p !== url),
    );
    expect(after.photos).not.toContain(url);
    expect((await nativeFetch(BASE + url)).status).toBe(404);
    expect((await nativeFetch(`${BASE}/api/listing-photos/..%2F..%2Fserver.js`)).status).toBe(404);
  });

  it('another account cannot touch the listing; a visitor cannot list', async () => {
    await signIn('0590000003', 'User#12345');
    await expect(myListingsApi.edit(original, { name: 'x' })).rejects.toMatchObject({ status: 404 });
    await expect(
      myListingsApi.upload(original, new Blob([PNG], { type: 'image/png' })),
    ).rejects.toMatchObject({ status: 404 });
    useAuthStore.setState({ user: null });
    await expect(myListingsApi.list()).rejects.toMatchObject({ status: 401 });
    await asProvider();
  });
});
