import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/types/auth';

// The signed-in account's own profile (server/routes/auth.js: GET / PATCH /api/auth/profile). The phone is the login and
// is read-only here; the role and the linked listing are the admin's.
export interface Profile {
  user_id: number;
  full_name: string | null;
  phone: string;
  whatsapp_number: string | null;
  email: string | null;
  role: Role;
}
/** Only the fields sent change; '' clears WhatsApp / email. */
export interface ProfileEdit {
  full_name?: string;
  whatsapp_number?: string;
  email?: string;
}

export const profileApi = {
  get: () => api.get<{ success: true; profile: Profile }>('/api/auth/profile'),
  update: (body: ProfileEdit) => api.patch<{ success: true; profile: Profile }>('/api/auth/profile', body),
};

export const profileKeys = { me: ['profile'] as const };

export function useProfile() {
  return useQuery({ queryKey: profileKeys.me, queryFn: async () => (await profileApi.get()).profile });
}

/** Saves, and keeps the session's copy (header name, account menu) in step. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: profileApi.update,
    onSuccess: ({ profile }) => {
      qc.setQueryData(profileKeys.me, profile);
      useAuthStore.getState().updateUser({
        full_name: profile.full_name,
        whatsapp_number: profile.whatsapp_number,
        email: profile.email,
      });
    },
  });
}
