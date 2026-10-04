import { useMutation } from '@tanstack/react-query';
import { api } from './client';
import type { SubmissionInput } from './listingSubmissions';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';

// Shapes read from server.js: /api/auth/login, /verify-session, /change-password.
export interface LoginRequest {
  phone: string;
  password: string;
  email?: string;
}
export interface LoginResponse {
  message: string;
  user: AuthUser;
}
export interface VerifySessionResponse {
  valid: boolean;
  reason?: 'missing_user_id' | 'not_found' | 'inactive' | 'force_logout';
  /** True when the server failed open (DB hiccup) — treat as valid. */
  error?: boolean;
}
export interface ChangePasswordRequest {
  userId: number;
  currentPassword: string;
  newPassword: string;
}
export interface ChangePasswordResponse {
  status: 'success';
  message: string;
}

export interface RegisterRequest {
  name: string;
  phone: string;
  whatsapp_number: string;
  password: string;
  email?: string;
  /** A business to put on the map, approved together with the account (see api/listingSubmissions.ts). */
  listing?: SubmissionInput;
}
export interface RegisterResponse {
  status: 'success';
  message: string;
  user: { user_id: number; full_name: string; email: string; phone: string; role: string; whatsapp_number: string | null };
}

export const authApi = {
  register: (body: RegisterRequest) => api.post<RegisterResponse>('/api/auth/register', body),
  login: (body: LoginRequest) => api.post<LoginResponse>('/api/auth/login', body),
  verifySession: (userId: number) =>
    api.post<VerifySessionResponse>('/api/auth/verify-session', { user_id: userId }),
  changePassword: (body: ChangePasswordRequest) =>
    api.post<ChangePasswordResponse>('/api/auth/change-password', body),
  /** Is this session still alive? A 401 logs the user out (client.ts); used when the socket is refused or the tab returns. */
  session: () => api.get<{ success: true; uid: number; role: string }>('/api/auth/session'),
  /** Ends this token on the server too. Takes the token explicitly: the store has already dropped it. */
  logout: (token: string) =>
    api.post<{ success: boolean }>('/api/auth/logout', undefined, { headers: { Authorization: `Bearer ${token}` } }),
};

export function useLogin() {
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user }) => useAuthStore.getState().setSession(user),
  });
}

/**
 * Creates the account and logs it in (new accounts are active at once); the caller starts the session with the returned
 * user. `user: null` = the account exists but the login did not go through (an admin switched it off, the login
 * limiter) — the person goes to the login page.
 */
export function useRegister() {
  return useMutation({
    mutationFn: async (body: RegisterRequest) => {
      await authApi.register(body);
      try {
        return { user: (await authApi.login({ phone: body.phone, password: body.password })).user };
      } catch {
        return { user: null };
      }
    },
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: authApi.changePassword });
}
