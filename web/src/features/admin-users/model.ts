import type { AdminUser, RequestPeriod, UserUpdate } from '@/api/adminUsers';
import { parseServerDate } from '@/lib/format';
import type { Role } from '@/types/auth';

export { parseServerDate };

// Pure logic of the users page (filters, sorting, the edit form) — kept out of the components so it is testable.

export type RoleFilter = '' | Role;
export type ActiveFilter = '' | 'active' | 'inactive';
export type OnlineFilter = '' | 'online' | 'offline';
export type LinkFilter = '' | 'linked' | 'unlinked';
export type DateFilter = '' | '2days' | 'week' | 'month' | 'custom';

export interface UserFilters {
  search: string;
  role: RoleFilter;
  active: ActiveFilter;
  online: OnlineFilter;
  linked: LinkFilter;
  date: DateFilter;
  /** `YYYY-MM-DD` from a date input; used when `date` is `custom`. */
  customDate: string;
}

export const NO_FILTERS: UserFilters = {
  search: '',
  role: '',
  active: '',
  online: '',
  linked: '',
  date: '',
  customDate: '',
};

export const hasFilters = (f: UserFilters) => Object.entries(f).some(([, v]) => v !== '');

const userName = (u: AdminUser) => u.full_name ?? '';

/** Same rules as legacy `applyFilters` (text is a case-insensitive "contains" on name / email / phone). */
export function filterUsers(
  users: readonly AdminUser[],
  f: UserFilters,
  onlineIds: ReadonlySet<string>,
  now: Date = new Date(),
): AdminUser[] {
  const term = f.search.toLowerCase().trim();
  return users.filter((u) => {
    if (term) {
      const hit =
        userName(u).toLowerCase().includes(term) ||
        (u.email ?? '').toLowerCase().includes(term) ||
        (u.phone ?? '').includes(term);
      if (!hit) return false;
    }
    if (f.role && u.role !== f.role) return false;
    if (f.active === 'active' && !u.is_active) return false;
    if (f.active === 'inactive' && u.is_active) return false;
    const online = onlineIds.has(String(u.user_id));
    if (f.online === 'online' && !online) return false;
    if (f.online === 'offline' && online) return false;
    if (f.linked === 'linked' && !u.service_layer) return false;
    if (f.linked === 'unlinked' && u.service_layer) return false;
    if (f.date) {
      const created = parseServerDate(u.created_at);
      if (!created) return false;
      if (f.date === 'custom') {
        if (f.customDate) {
          // `YYYY-MM-DD` is read as a local calendar day (new Date('2026-06-28') would be UTC → off by one).
          const [y, m, d] = f.customDate.split('-').map(Number);
          const sameDay =
            created.getFullYear() === y && created.getMonth() === m - 1 && created.getDate() === d;
          if (!sameDay) return false;
        }
      } else {
        const cutoff = new Date(now);
        if (f.date === '2days') cutoff.setDate(cutoff.getDate() - 2);
        else if (f.date === 'week') cutoff.setDate(cutoff.getDate() - 7);
        else cutoff.setMonth(cutoff.getMonth() - 1);
        if (created < cutoff) return false;
      }
    }
    return true;
  });
}

/** Newest account first; equal / missing dates fall back to the highest id (legacy order). */
export function newestFirst(a: AdminUser, b: AdminUser): number {
  const da = parseServerDate(a.created_at)?.getTime() ?? 0;
  const db = parseServerDate(b.created_at)?.getTime() ?? 0;
  return db - da || b.user_id - a.user_id;
}

// ---- edit form ----

export interface EditForm {
  is_active: boolean;
  role: Role;
  /** '' = not linked. */
  service_layer: string;
  feature_id: string;
  /** '' = unlimited. */
  request_limit: string;
  request_limit_period: RequestPeriod;
  /** '' = keep the current password. */
  new_password: string;
}

export const MIN_PASSWORD = 6;

export function formFromUser(u: AdminUser): EditForm {
  return {
    is_active: u.is_active === true,
    role: u.role,
    service_layer: u.service_layer ?? '',
    feature_id: u.feature_id == null ? '' : String(u.feature_id),
    request_limit: u.request_limit ? String(u.request_limit) : '',
    request_limit_period: u.request_limit_period ?? 'daily',
    new_password: '',
  };
}

export type FormErrors = Partial<
  Record<'feature_id' | 'request_limit' | 'new_password', 'integer' | 'min' | 'short'>
>;

const isPositiveInt = (s: string) => /^\d+$/.test(s) && Number(s) > 0;

export function validateForm(f: EditForm): FormErrors {
  const errors: FormErrors = {};
  if (f.service_layer && f.feature_id.trim() && !isPositiveInt(f.feature_id.trim()))
    errors.feature_id = 'integer';
  if (f.request_limit.trim() && !isPositiveInt(f.request_limit.trim())) errors.request_limit = 'min';
  if (f.new_password && f.new_password.trim().length < MIN_PASSWORD) errors.new_password = 'short';
  return errors;
}

/**
 * The request body for `POST /api/admin/users/update`: only what changed (the server notifies the user and forces
 * a re-login on every save, so an untouched field must not be sent). `null` = nothing changed.
 */
export function buildUpdate(u: AdminUser, f: EditForm): UserUpdate | null {
  const body: UserUpdate = { user_id: u.user_id };
  let changed = false;

  if (f.role !== u.role) {
    body.role = f.role;
    changed = true;
  }
  if (f.is_active !== (u.is_active === true)) {
    body.is_active = f.is_active;
    changed = true;
  }

  const layer = f.service_layer.trim();
  const featureText = layer ? f.feature_id.trim() : '';
  if (
    layer !== (u.service_layer ?? '') ||
    featureText !== (u.feature_id == null ? '' : String(u.feature_id))
  ) {
    body.service_layer = layer || null;
    body.feature_id = featureText ? Number(featureText) : null;
    changed = true;
  }

  const limit = f.request_limit.trim() ? Number(f.request_limit.trim()) : null;
  const periodNow = u.request_limit_period ?? 'daily';
  if (limit !== (u.request_limit || null) || (limit !== null && f.request_limit_period !== periodNow)) {
    body.request_limit = limit;
    body.request_limit_period = limit === null ? periodNow : f.request_limit_period;
    changed = true;
  }

  if (f.new_password.trim()) {
    body.new_password = f.new_password.trim();
    changed = true;
  }
  return changed ? body : null;
}
