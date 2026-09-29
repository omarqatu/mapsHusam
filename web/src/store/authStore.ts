import { create } from 'zustand';
import type { AuthUser } from '@/types/auth';

/**
 * Session storage is deliberately the legacy format: localStorage `map_user` = the raw login `user`
 * JSON. The React app and the legacy pages then share one session while both exist, and users stay
 * logged in across the cut-over. Nothing else in the app may read this key or the token.
 */
export const SESSION_KEY = 'map_user';
const LEGACY_KEYS = ['map_user', 'user'];

function readStored(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'token' in parsed && 'role' in parsed)
      return parsed as AuthUser;
  } catch {
    /* storage blocked or corrupt — treated as logged out */
  }
  return null;
}

function writeStored(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

interface AuthState {
  user: AuthUser | null;
  setSession: (user: AuthUser) => void;
  /** The server rotates the token (X-New-Token) after a password change. */
  replaceToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: readStored(),
  setSession: (user) => {
    writeStored(user);
    set({ user });
  },
  replaceToken: (token) => {
    const user = get().user;
    if (!user) return;
    const next = { ...user, token, admin_token: user.admin_token ? token : null };
    writeStored(next);
    set({ user: next });
  },
  logout: () => {
    // Legacy `logoutPlatform` also dropped this per-user key (nothing writes it any more; old browsers may still hold it).
    try {
      const id = get().user?.user_id ?? get().user?.id;
      if (id != null) localStorage.removeItem(`provider_status_${id}`);
    } catch {
      /* ignore */
    }
    writeStored(null);
    set({ user: null });
  },
}));

export const getToken = () => useAuthStore.getState().user?.token ?? null;
