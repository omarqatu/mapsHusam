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
};

export function useLogin() {
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user }) => useAuthStore.getState().setSession(user),
  });
}

/** New accounts are created inactive (status 0): no session is started, the user waits for activation. */
export function useRegister() {
  return useMutation({ mutationFn: authApi.register });
}

export function useChangePassword() {
  return useMutation({ mutationFn: authApi.changePassword });
}
