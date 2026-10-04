// @vitest-environment node
// Real-backend test (no mocks) for the admin pages' endpoints: users, the read-only view session, the dashboard stats.
//   cd web && VITE_LIVE_API=http://localhost:3000 npm test
// Every account change is made on THROWAWAY users ("LIVE-ADMIN-…", removed again in afterAll). The seeded accounts are only
// used to log in, and the bulk log-out targets "all" / "online" / "offline" are NOT called (they would log them out).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminStatsApi } from '@/api/adminStats';
import { adminUsersApi } from '@/api/adminUsers';
import { authApi } from '@/api/auth';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { deleteThrowawayUsers } from '@/test/liveDb';

const BASE = import.meta.env.VITE_LIVE_API;
const nativeFetch = globalThis.fetch;
const PREFIX = 'LIVE-ADMIN-';
const stamp = String(Date.now()).slice(-6);
const phoneA = `0599${stamp}`;
const phoneB = `0598${stamp}`;
let idA = 0;
let idB = 0;

async function asAdmin() {
  const { user } = await authApi.login({ phone: '0590000001', password: 'Admin#12345' });
  useAuthStore.getState().setSession(user);
}

describe.skipIf(!BASE)('admin endpoints against the live backend', () => {
  beforeAll(async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(
        typeof input === 'string' && input.startsWith('/') ? BASE + input : input,
        init,
      )) as typeof fetch;
    for (const [phone, n] of [
      [phoneA, 'A'],
      [phoneB, 'B'],
    ] as const)
      await authApi.register({
        name: `${PREFIX}${n}-${stamp}`,
        phone,
        whatsapp_number: phone,
        password: 'secret1',
      });
    await asAdmin();
    const users = (await adminUsersApi.list()).users;
    idA = users.find((u) => u.phone === phoneA)!.user_id;
    idB = users.find((u) => u.phone === phoneB)!.user_id;
  });
  afterAll(() => {
    deleteThrowawayUsers(PREFIX);
    globalThis.fetch = nativeFetch;
    useAuthStore.setState({ user: null });
  });

  it('lists users with the shape the page relies on, and the online ids', async () => {
    const res = await adminUsersApi.list();
    expect(res.success).toBe(true);
    expect(Array.isArray(res.onlineUserIds)).toBe(true);
    const a = res.users.find((u) => u.user_id === idA)!;
    expect(a).toMatchObject({ role: 'user', is_active: true, service_layer: null, request_limit: null });
    for (const k of [
      'user_id',
      'full_name',
      'email',
      'phone',
      'role',
      'is_active',
      'service_layer',
      'feature_id',
      'created_at',
      'request_limit',
      'request_limit_period',
      'is_online',
    ])
      expect(a).toHaveProperty(k);
    expect((await adminUsersApi.online()).onlineUserIds).toBeInstanceOf(Array);
  });

  it('activate / deactivate decides whether the account can log in', async () => {
    // a new account is active at once
    const { user } = await authApi.login({ phone: phoneA, password: 'secret1' });
    expect(user.user_id).toBe(idA);
    await adminUsersApi.update({ user_id: idA, is_active: false });
    await expect(authApi.login({ phone: phoneA, password: 'secret1' })).rejects.toBeTruthy();
    expect((await authApi.verifySession(idA)).valid).toBe(false);
    await adminUsersApi.update({ user_id: idA, is_active: true });
    expect((await adminUsersApi.list()).users.find((u) => u.user_id === idA)!.is_active).toBe(true);
  });

  it('changes the role, the service link, the request quota and the password', async () => {
    await adminUsersApi.update({
      user_id: idA,
      role: 'provider',
      service_layer: 'plumber',
      feature_id: 987654,
    });
    let a = (await adminUsersApi.list()).users.find((u) => u.user_id === idA)!;
    expect(a).toMatchObject({ role: 'provider', service_layer: 'plumber', feature_id: 987654 });

    await adminUsersApi.update({ user_id: idA, request_limit: 5, request_limit_period: 'weekly' });
    a = (await adminUsersApi.list()).users.find((u) => u.user_id === idA)!;
    expect(a).toMatchObject({ request_limit: 5, request_limit_period: 'weekly' });

    // unlinking + unlimited (null clears)
    await adminUsersApi.update({
      user_id: idA,
      role: 'user',
      service_layer: null,
      feature_id: null,
      request_limit: null,
    });
    a = (await adminUsersApi.list()).users.find((u) => u.user_id === idA)!;
    expect(a).toMatchObject({ role: 'user', service_layer: null, feature_id: null, request_limit: null });

    await adminUsersApi.update({ user_id: idA, new_password: 'changed-77' });
    await expect(authApi.login({ phone: phoneA, password: 'secret1' })).rejects.toBeTruthy();
    expect((await authApi.login({ phone: phoneA, password: 'changed-77' })).user.role).toBe('user');
  });

  it('rejects nothing-to-change (400) and an unknown user (404)', async () => {
    await expect(adminUsersApi.update({ user_id: idA })).rejects.toMatchObject({ status: 400 });
    await expect(adminUsersApi.update({ user_id: 999999999, is_active: true })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('force log-out flags one user; logging in again clears the flag', async () => {
    const res = await adminUsersApi.forceLogout(idA);
    expect(res.wasOnline).toBe(false);
    expect((await authApi.verifySession(idA)).reason).toBe('force_logout');
    await authApi.login({ phone: phoneA, password: 'changed-77' });
    expect((await authApi.verifySession(idA)).valid).toBe(true);
    await expect(adminUsersApi.forceLogout(999999999)).rejects.toMatchObject({ status: 404 });
  });

  it('bulk force log-out "selected" hits only the chosen throwaway users', async () => {
    await adminUsersApi.update({ user_id: idB, is_active: true });
    await authApi.login({ phone: phoneB, password: 'secret1' });
    const res = await adminUsersApi.forceLogoutAll('selected', [idA, idB]);
    expect(res).toMatchObject({ success: true, total: 2, online: 0, offline: 2 });
    expect((await authApi.verifySession(idB)).reason).toBe('force_logout');
    // the seeded admin (who is making the call) is untouched
    expect((await authApi.verifySession(useAuthStore.getState().user!.user_id)).valid).toBe(true);
    await expect(adminUsersApi.forceLogoutAll('selected', [])).rejects.toMatchObject({ status: 400 });
    await expect(adminUsersApi.forceLogoutAll('nobody' as never)).rejects.toMatchObject({ status: 400 });
  });

  it('a normal user is refused every admin route (403) and keeps their session', async () => {
    const { user } = await authApi.login({ phone: phoneA, password: 'changed-77' });
    useAuthStore.getState().setSession(user);
    try {
      await expect(adminUsersApi.list()).rejects.toMatchObject({ status: 403 });
      await expect(adminUsersApi.update({ user_id: idB, role: 'admin' })).rejects.toMatchObject({
        status: 403,
      });
      await expect(adminStatsApi.list()).rejects.toMatchObject({ status: 403 });
      expect(useAuthStore.getState().user).not.toBeNull();
    } finally {
      await asAdmin();
    }
  });

  it('read-only view session: profile, requests, messages; a bad token is 401 without logging the admin out', async () => {
    // a request row for user A: a call click on a feature with no provider (the row's provider is the user)
    const a = await authApi.login({ phone: phoneA, password: 'changed-77' });
    useAuthStore.getState().setSession(a.user);
    const click = await api.post<{ success: true; id: number }>('/api/log-contact-click', {
      service_layer: 'plumber',
      feature_id: 987654,
      provider_name: 'LIVE-ADMIN provider',
      contact_type: 'call',
    });
    await asAdmin();

    const session = await adminUsersApi.viewSession(idA);
    expect(session.expires_in).toBe(1800);
    expect(session.user).toMatchObject({ user_id: idA, role: 'user' });
    const profile = await adminUsersApi.viewProfile(session.token);
    expect(profile.user).toMatchObject({ user_id: idA, phone: phoneA });
    const reqs = await adminUsersApi.viewRequests(session.token);
    expect(reqs.requests.map((r) => r.id)).toContain(click.id);
    const msgs = await adminUsersApi.viewMessages(session.token, click.id);
    expect(msgs.messages).toEqual([]);
    await expect(adminUsersApi.viewMessages(session.token, 999999999)).rejects.toMatchObject({ status: 404 });

    await expect(adminUsersApi.viewProfile('garbage')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().user).not.toBeNull(); // still logged in
    await expect(adminUsersApi.viewSession(999999999)).rejects.toMatchObject({ status: 404 });
    await expect(adminUsersApi.viewSession(0)).rejects.toMatchObject({ status: 400 });
    await expect(adminUsersApi.viewProfile('')).rejects.toMatchObject({ status: 401 });
  });

  it('dashboard stats list the click, and deleting it removes it', async () => {
    const before = (await adminStatsApi.list()).stats;
    const row = before.find((r) => r.provider_name === 'LIVE-ADMIN provider')!;
    expect(row).toMatchObject({
      status: 'completed',
      contact_type: 'call',
      service_layer: 'plumber',
      user_id: idA,
    });
    expect(row.username).toContain(PREFIX);
    await adminStatsApi.remove(row.id);
    const after = (await adminStatsApi.list()).stats;
    expect(after.find((r) => r.id === row.id)).toBeUndefined();
    expect(after.length).toBe(before.length - 1);
  });
});
