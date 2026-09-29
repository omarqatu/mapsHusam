import { useMutation } from '@tanstack/react-query';
import { api } from './client';
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

export const authApi = {
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

export function useChangePassword() {
  return useMutation({ mutationFn: authApi.changePassword });
}
