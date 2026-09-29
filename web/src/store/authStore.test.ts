import { beforeEach, describe, expect, it } from 'vitest';
import { SESSION_KEY, useAuthStore } from './authStore';
import type { AuthUser } from '@/types/auth';

const user = { user_id: 1, role: 'user', token: 't', admin_token: null, phone: '1' } as AuthUser;

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null });
  });

  it('persists the raw user object under the legacy key so both frontends share the session', () => {
    useAuthStore.getState().setSession(user);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!)).toEqual(user);
  });

  it('logout clears the store and both legacy storage keys', () => {
    localStorage.setItem('user', '{}');
    useAuthStore.getState().setSession(user);
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem('map_user')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('logout drops the legacy per-user provider_status key', () => {
    useAuthStore.getState().setSession(user);
    localStorage.setItem('provider_status_1', 'x');
    localStorage.setItem('provider_status_2', 'y');
    useAuthStore.getState().logout();
    expect(localStorage.getItem('provider_status_1')).toBeNull();
    expect(localStorage.getItem('provider_status_2')).toBe('y');
  });

  it('replaceToken only rewrites admin_token for admins', () => {
    useAuthStore.getState().setSession(user);
    useAuthStore.getState().replaceToken('n');
    expect(useAuthStore.getState().user).toMatchObject({ token: 'n', admin_token: null });
  });
});
