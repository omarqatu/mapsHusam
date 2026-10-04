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
  /** The account edited its own profile (name, WhatsApp, email). */
  updateUser: (fields: Partial<Pick<AuthUser, 'full_name' | 'whatsapp_number' | 'email'>>) => void;
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
  updateUser: (fields) => {
    const user = get().user;
    if (!user) return;
    const next = { ...user, ...fields };
    writeStored(next);
    set({ user: next });
  },
  logout: () => {
    // Per-user keys go with the session: the request ids not opened yet (features/requests/unseen.ts), and a key
    // legacy `logoutPlatform` also dropped (nothing writes it any more; old browsers may still hold it).
    try {
      const id = get().user?.user_id ?? get().user?.id;
      if (id != null) {
        localStorage.removeItem(`svc_unseen_${id}`);
        localStorage.removeItem(`provider_status_${id}`);
      }
    } catch {
      /* ignore */
    }
    const token = get().user?.token;
    writeStored(null);
    set({ user: null });
    // Removing the token from this browser is not enough: a copy of it would stay valid on the server until it
    // expires. Imported lazily (the API client imports this store); failures are ignored, the user is out locally.
    if (token) void import('@/api/auth').then(({ authApi }) => authApi.logout(token)).catch(() => undefined);
  },
}));

export const getToken = () => useAuthStore.getState().user?.token ?? null;
