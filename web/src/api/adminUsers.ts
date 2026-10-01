import { api } from './client';
import type { Role } from '@/types/auth';

// Admin user management (legacy admin-users.html + admin-view-user.html). Every route needs an admin token; the
// server re-checks role / is_active / force_logout_flag on each call. Errors: `{ success:false, error }`.

export type RequestPeriod = 'daily' | 'weekly' | 'monthly';
export const REQUEST_PERIODS: RequestPeriod[] = ['daily', 'weekly', 'monthly'];

/** A row of `GET /api/admin/users`. Postgres timestamps arrive as ISO strings. */
export interface AdminUser {
  user_id: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  is_active: boolean;
  status: number | null;
  service_layer: string | null;
  feature_id: number | null;
  x_coord: number | string | null;
  y_coord: number | string | null;
  created_at: string | null;
  /** null = unlimited. */
  request_limit: number | null;
  request_limit_period: RequestPeriod | null;
  is_online: boolean;
}

export interface AdminUsersResponse {
  success: true;
  users: AdminUser[];
  /** User ids (as strings) with a live socket right now. */
  onlineUserIds: string[];
  total: number;
}

/** Only the keys present are changed (server: `undefined` = leave alone; nothing at all = 400). */
export interface UserUpdate {
  user_id: number;
  role?: Role;
  is_active?: boolean;
  service_layer?: string | null;
  feature_id?: number | null;
  new_password?: string;
  request_limit?: number | null;
  request_limit_period?: RequestPeriod;
}

export type LogoutTarget = 'all' | 'online' | 'offline' | 'selected';

export interface LogoutAllResult {
  success: true;
  message: string;
  total: number;
  online: number;
  offline: number;
}

// ---- read-only view session (temporary token, 30 min) ----

export interface ViewUser {
  user_id: number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: Role;
  is_active: boolean;
  service_layer: string | null;
  feature_id: number | null;
}
export interface ViewSession {
  success: true;
  token: string;
  /** Seconds. */
  expires_in: number;
  user: ViewUser;
}
export interface ViewRequest {
  id: number;
  user_id: number;
  provider_user_id: number | null;
  service_layer: string | null;
  feature_id: number | null;
  provider_name: string | null;
  service_type: string | null;
  status: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string | null;
  requester_name: string | null;
  provider_full_name: string | null;
}
export interface ViewMessage {
  id: number;
  request_id: number;
  sender_role: string;
  sender_id: number;
  message: string;
  created_at: string;
}

/**
 * The three read-only view calls need both: the admin's own session (Authorization, added by the client) and the
 * view token that names the user being viewed (`X-Read-Only-View`, bound by the server to the admin who created it).
 * A 401 on them (an expired view link) keeps the admin logged in.
 */
const viewAuth = (token: string) => ({ headers: { 'X-Read-Only-View': token } });

export const adminUsersApi = {
  list: () => api.get<AdminUsersResponse>('/api/admin/users'),
  online: () => api.get<{ success: true; onlineUserIds: string[] }>('/api/admin/online-users'),
  update: (body: UserUpdate) => api.post<{ success: true; message: string }>('/api/admin/users/update', body),
  forceLogout: (user_id: number) =>
    api.post<{ success: true; message: string; wasOnline: boolean }>('/api/admin/users/force-logout', {
      user_id,
    }),
  forceLogoutAll: (target_type: LogoutTarget, user_ids?: number[]) =>
    api.post<LogoutAllResult>('/api/admin/users/force-logout-all', { target_type, user_ids }),
  viewSession: (user_id: number) => api.post<ViewSession>('/api/admin/view-session', { user_id }),
  viewProfile: (token: string) =>
    api.get<{ success: true; user: ViewUser }>('/api/admin/view-session/profile', undefined, viewAuth(token)),
  viewRequests: (token: string) =>
    api.get<{ success: true; requests: ViewRequest[] }>(
      '/api/admin/view-session/requests',
      undefined,
      viewAuth(token),
    ),
  viewMessages: (token: string, requestId: number) =>
    api.get<{ success: true; request: unknown; messages: ViewMessage[] }>(
      `/api/admin/view-session/requests/${encodeURIComponent(String(requestId))}/messages`,
      undefined,
      viewAuth(token),
    ),
};
