import type { SuccessStatRow } from '@/api/adminStats';

// Pure logic of the provider-statistics dashboard (legacy dashboard.html): status / contact mapping + column filters.

export type StatusKey = 'success' | 'pending' | 'cancelled';
export type ContactKey = 'call' | 'whatsapp' | 'service_request';

/** completed / success → successful; cancelled / rejected → cancelled; anything else (accepted, pending, …) → pending. */
export function mapStatus(raw: string | null | undefined): StatusKey {
  const s = (raw ?? '').toLowerCase();
  if (s === 'completed' || s === 'success') return 'success';
  if (s === 'cancelled' || s === 'rejected') return 'cancelled';
  return 'pending';
}

/** Unknown / empty contact types are service requests (the table's default). */
export function mapContact(raw: string | null | undefined): ContactKey {
  const c = (raw ?? '').toLowerCase().trim();
  return c === 'call' || c === 'whatsapp' ? c : 'service_request';
}

/** A server row with the values the table filters on already normalised. */
export interface StatRow {
  id: number;
  username: string;
  provider: string;
  /** Layer key (`plumber`); shown through `services.<key>`. */
  layer: string;
  phone: string;
  /** The row's own timestamp (legacy: updated_at, else created_at). */
  date: string | null;
  contact: ContactKey;
  status: StatusKey;
  reason: string;
}

export function toRow(r: SuccessStatRow): StatRow {
  return {
    id: r.id,
    username: r.username ?? '',
    provider: r.provider_name ?? '',
    layer: (r.service_layer ?? '').trim(),
    phone: r.provider_phone ?? '',
    date: r.updated_at || r.created_at || null,
    contact: mapContact(r.contact_type),
    status: mapStatus(r.status),
    reason: r.cancellation_reason ?? '',
  };
}

export interface StatFilters {
  /** "contains" text boxes, case-insensitive. */
  username: string;
  provider: string;
  phone: string;
  reason: string;
  /** Exact-match drop-downs built from the data ('' = all). */
  usernameExact: string;
  providerExact: string;
  reasonExact: string;
  layer: string;
  contact: '' | ContactKey;
  status: '' | StatusKey;
  /** `dd/mm/yyyy` (Arabic digits accepted); ignored until it is a complete valid date. */
  date: string;
}

export const NO_STAT_FILTERS: StatFilters = {
  username: '',
  provider: '',
  phone: '',
  reason: '',
  usernameExact: '',
  providerExact: '',
  reasonExact: '',
  layer: '',
  contact: '',
  status: '',
  date: '',
};

export const hasStatFilters = (f: StatFilters) => Object.values(f).some((v) => v !== '');

/** Arabic-Indic digits (٠-٩) → ASCII so a date can be typed with either keyboard. */
export function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export interface DayMonthYear {
  day: number;
  month: number;
  year: number;
}

/** `22/08/2026` → parts; null when incomplete or impossible. */
export function parseTypedDate(text: string): DayMonthYear | null {
  const m = normalizeDigits(text)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { day, month, year };
}

/** `2026-08-22` (date input) → `22/08/2026`. */
export function toTypedDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

const has = (value: string, term: string) => value.toLowerCase().includes(term.toLowerCase().trim());

export function filterRows(rows: readonly StatRow[], f: StatFilters): StatRow[] {
  const day = parseTypedDate(f.date);
  return rows.filter((r) => {
    if (f.username && !has(r.username, f.username)) return false;
    if (f.provider && !has(r.provider, f.provider)) return false;
    if (f.phone && !has(r.phone, f.phone)) return false;
    if (f.reason && !has(r.reason, f.reason)) return false;
    if (f.usernameExact && r.username !== f.usernameExact) return false;
    if (f.providerExact && r.provider !== f.providerExact) return false;
    if (f.reasonExact && r.reason !== f.reasonExact) return false;
    if (f.layer && r.layer !== f.layer) return false;
    if (f.contact && r.contact !== f.contact) return false;
    if (f.status && r.status !== f.status) return false;
    if (day) {
      const d = r.date ? new Date(r.date) : null;
      if (!d || Number.isNaN(d.getTime())) return false;
      if (d.getDate() !== day.day || d.getMonth() + 1 !== day.month || d.getFullYear() !== day.year)
        return false;
    }
    return true;
  });
}

/** Distinct non-empty values of a text column, sorted, for the exact-match drop-downs. */
export function distinct(
  rows: readonly StatRow[],
  key: 'username' | 'provider' | 'reason' | 'layer',
): string[] {
  return [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function countByStatus(rows: readonly StatRow[]): Record<StatusKey, number> {
  const out: Record<StatusKey, number> = { success: 0, pending: 0, cancelled: 0 };
  rows.forEach((r) => (out[r.status] += 1));
  return out;
}
