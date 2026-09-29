export type Role = 'admin' | 'provider' | 'user';

/** `user` object returned by POST /api/auth/login (server.js) — also what legacy stores in localStorage `map_user`. */
export interface AuthUser {
  user_id: number;
  id: number;
  full_name: string | null;
  email: string | null;
  phone: string;
  whatsapp_number: string | null;
  role: Role;
  status: number;
  target_layer: string | null;
  targetId: number | string | null;
  target_id: number | string | null;
  x_coord: number | string | null;
  y_coord: number | string | null;
  /** Set only for admins; same value as `token`. */
  admin_token: string | null;
  token: string;
}
