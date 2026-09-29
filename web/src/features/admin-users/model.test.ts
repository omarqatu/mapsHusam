import { describe, expect, it } from 'vitest';
import type { AdminUser } from '@/api/adminUsers';
import {
  buildUpdate,
  filterUsers,
  formFromUser,
  newestFirst,
  NO_FILTERS,
  parseServerDate,
  validateForm,
} from './model';

const u = (over: Partial<AdminUser>): AdminUser => ({
  user_id: 1,
  full_name: 'Sami Ali',
  email: 'sami@x.com',
  phone: '0591111111',
  role: 'user',
  is_active: true,
  status: 0,
  service_layer: null,
  feature_id: null,
  x_coord: null,
  y_coord: null,
  created_at: '2026-09-20T10:00:00.000Z',
  request_limit: null,
  request_limit_period: 'daily',
  is_online: false,
  ...over,
});

const users = [
  u({ user_id: 1 }),
  u({
    user_id: 2,
    full_name: 'Lina',
    email: null,
    phone: '0592222222',
    role: 'provider',
    service_layer: 'plumber',
    feature_id: 5,
    is_active: false,
    created_at: '2026-09-28T10:00:00.000Z',
  }),
  u({ user_id: 3, full_name: null, phone: null, role: 'admin', created_at: null }),
];
const ids = (list: AdminUser[]) => list.map((x) => x.user_id);
const NOW = new Date('2026-09-29T12:00:00');

describe('parseServerDate', () => {
  it('reads ISO, Postgres microseconds with a space, and rejects junk', () => {
    expect(parseServerDate('2026-06-28T22:35:58.529Z')?.toISOString()).toBe('2026-06-28T22:35:58.529Z');
    expect(parseServerDate('2026-06-28 22:35:58.529724')).toBeInstanceOf(Date);
    expect(parseServerDate('nope')).toBeNull();
    expect(parseServerDate(null)).toBeNull();
  });
});

describe('filterUsers', () => {
  const online = new Set(['2']);
  it('searches name, email and phone case-insensitively', () => {
    expect(ids(filterUsers(users, { ...NO_FILTERS, search: 'SAMI' }, online, NOW))).toEqual([1, 3]); // email of 3 = sami@x.com
    expect(ids(filterUsers(users, { ...NO_FILTERS, search: 'lina' }, online, NOW))).toEqual([2]);
    expect(ids(filterUsers(users, { ...NO_FILTERS, search: '0592' }, online, NOW))).toEqual([2]);
  });
  it('filters by role, active state, online state and service link', () => {
    expect(ids(filterUsers(users, { ...NO_FILTERS, role: 'admin' }, online, NOW))).toEqual([3]);
    expect(ids(filterUsers(users, { ...NO_FILTERS, active: 'inactive' }, online, NOW))).toEqual([2]);
    expect(ids(filterUsers(users, { ...NO_FILTERS, online: 'online' }, online, NOW))).toEqual([2]);
    expect(ids(filterUsers(users, { ...NO_FILTERS, online: 'offline' }, online, NOW))).toEqual([1, 3]);
    expect(ids(filterUsers(users, { ...NO_FILTERS, linked: 'linked' }, online, NOW))).toEqual([2]);
    expect(ids(filterUsers(users, { ...NO_FILTERS, linked: 'unlinked' }, online, NOW))).toEqual([1, 3]);
  });
  it('date filters: relative windows drop rows without a date; custom = the same local calendar day', () => {
    expect(ids(filterUsers(users, { ...NO_FILTERS, date: '2days' }, online, NOW))).toEqual([2]);
    expect(ids(filterUsers(users, { ...NO_FILTERS, date: 'week' }, online, NOW))).toEqual([2]);
    expect(ids(filterUsers(users, { ...NO_FILTERS, date: 'month' }, online, NOW))).toEqual([1, 2]);
    const day = users[1].created_at!;
    const local = new Date(day);
    const iso = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
    expect(ids(filterUsers(users, { ...NO_FILTERS, date: 'custom', customDate: iso }, online, NOW))).toEqual([
      2,
    ]);
    // "custom" without a day chosen yet only drops rows that have no date (legacy)
    expect(ids(filterUsers(users, { ...NO_FILTERS, date: 'custom' }, online, NOW))).toEqual([1, 2]);
  });
});

describe('newestFirst', () => {
  it('sorts by created date desc, then by id desc; missing dates last', () => {
    expect(ids([...users].sort(newestFirst))).toEqual([2, 1, 3]);
    expect(
      ids([u({ user_id: 5, created_at: null }), u({ user_id: 9, created_at: null })].sort(newestFirst)),
    ).toEqual([9, 5]);
  });
});

describe('edit form', () => {
  const provider = users[1];
  it('sends nothing when nothing changed, and only the changed keys otherwise', () => {
    expect(buildUpdate(provider, formFromUser(provider))).toBeNull();
    expect(buildUpdate(provider, { ...formFromUser(provider), is_active: true })).toEqual({
      user_id: 2,
      is_active: true,
    });
    expect(buildUpdate(provider, { ...formFromUser(provider), role: 'user' })).toEqual({
      user_id: 2,
      role: 'user',
    });
  });
  it('unlinking clears the feature id too; linking sends both', () => {
    expect(buildUpdate(provider, { ...formFromUser(provider), service_layer: '' })).toEqual({
      user_id: 2,
      service_layer: null,
      feature_id: null,
    });
    const plain = users[0];
    expect(
      buildUpdate(plain, { ...formFromUser(plain), service_layer: 'painter', feature_id: '14' }),
    ).toEqual({
      user_id: 1,
      service_layer: 'painter',
      feature_id: 14,
    });
  });
  it('request limit: number + period, empty = null (unlimited); the period alone is ignored without a limit', () => {
    const plain = users[0];
    expect(
      buildUpdate(plain, { ...formFromUser(plain), request_limit: '5', request_limit_period: 'weekly' }),
    ).toEqual({
      user_id: 1,
      request_limit: 5,
      request_limit_period: 'weekly',
    });
    expect(buildUpdate(plain, { ...formFromUser(plain), request_limit_period: 'monthly' })).toBeNull();
    const limited = u({ request_limit: 3 });
    expect(buildUpdate(limited, { ...formFromUser(limited), request_limit: '' })?.request_limit).toBeNull();
  });
  it('validates feature id, limit and password length', () => {
    const f = formFromUser(users[0]);
    expect(validateForm({ ...f, service_layer: 'painter', feature_id: 'x' })).toEqual({
      feature_id: 'integer',
    });
    expect(validateForm({ ...f, request_limit: '0' })).toEqual({ request_limit: 'min' });
    expect(validateForm({ ...f, new_password: '123' })).toEqual({ new_password: 'short' });
    expect(validateForm({ ...f, new_password: '123456', request_limit: '2' })).toEqual({});
    expect(buildUpdate(users[0], { ...f, new_password: ' secret1 ' })?.new_password).toBe('secret1');
  });
});
