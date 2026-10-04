import { describe, expect, it } from 'vitest';
import type { SuccessStatRow } from '@/api/adminStats';
import {
  countByStatus,
  dailyCounts,
  distinct,
  filterRows,
  mapContact,
  mapStatus,
  NO_STAT_FILTERS,
  normalizeDigits,
  parseTypedDate,
  successRate,
  topBy,
  toRow,
  toTypedDate,
} from './model';

const row = (over: Partial<SuccessStatRow>): SuccessStatRow => ({
  id: 1,
  user_id: 1,
  provider_user_id: 2,
  service_layer: 'plumber',
  feature_id: 3,
  provider_name: 'Abu Ali',
  service_type: null,
  status: 'completed',
  contact_type: 'call',
  cancellation_reason: null,
  created_at: '2026-08-22T09:00:00',
  updated_at: null,
  username: 'Sami',
  requester_phone: null,
  provider_phone: '0591',
  ...over,
});

describe('mapping', () => {
  it('maps statuses and contact types like the legacy table', () => {
    expect(
      ['completed', 'success', 'cancelled', 'rejected', 'accepted', 'pending', 'x', null].map(mapStatus),
    ).toEqual(['success', 'success', 'cancelled', 'cancelled', 'pending', 'pending', 'pending', 'pending']);
    expect(['call', ' WhatsApp ', 'service_request', null, 'other'].map(mapContact)).toEqual([
      'call',
      'whatsapp',
      'service_request',
      'service_request',
      'service_request',
    ]);
  });
});

describe('typed dates', () => {
  it('reads dd/mm/yyyy with Arabic digits, rejects incomplete or impossible ones', () => {
    expect(normalizeDigits('٢٢/٠٨/٢٠٢٦')).toBe('22/08/2026');
    expect(parseTypedDate('٢٢/٠٨/٢٠٢٦')).toEqual({ day: 22, month: 8, year: 2026 });
    expect(parseTypedDate('22/08/26')).toBeNull();
    expect(parseTypedDate('32/01/2026')).toBeNull();
    expect(parseTypedDate('1/13/2026')).toBeNull();
    expect(toTypedDate('2026-08-22')).toBe('22/08/2026');
  });
});

describe('filterRows', () => {
  const rows = [
    toRow(row({ id: 1 })),
    toRow(
      row({
        id: 2,
        username: 'Lina',
        provider_name: 'Um Khaled',
        status: 'cancelled',
        cancellation_reason: 'changed my mind',
        service_layer: 'painter',
        contact_type: 'whatsapp',
        created_at: '2026-08-23T09:00:00',
      }),
    ),
    toRow(row({ id: 3, status: 'pending', contact_type: null, created_at: null })),
  ];
  const ids = (f: Partial<typeof NO_STAT_FILTERS>) =>
    filterRows(rows, { ...NO_STAT_FILTERS, ...f }).map((r) => r.id);

  it('text boxes contain, drop-downs match exactly', () => {
    expect(ids({ username: 'li' })).toEqual([2]);
    expect(ids({ usernameExact: 'Sami' })).toEqual([1, 3]);
    expect(ids({ providerExact: 'Abu' })).toEqual([]);
    expect(ids({ phone: '059' })).toEqual([1, 2, 3]);
    expect(ids({ reason: 'MIND' })).toEqual([2]);
    expect(ids({ layer: 'painter' })).toEqual([2]);
    expect(ids({ contact: 'service_request' })).toEqual([3]);
    expect(ids({ status: 'success' })).toEqual([1]);
  });
  it('filters by an exact day and ignores an incomplete typed date', () => {
    expect(ids({ date: '22/08/2026' })).toEqual([1]);
    expect(ids({ date: '٢٣/٠٨/٢٠٢٦' })).toEqual([2]);
    expect(ids({ date: '22/08' })).toEqual([1, 2, 3]);
  });
  it('counts by status and lists distinct values', () => {
    expect(countByStatus(rows)).toEqual({ success: 1, pending: 1, cancelled: 1 });
    expect(distinct(rows, 'username')).toEqual(['Lina', 'Sami']);
    expect(distinct(rows, 'reason')).toEqual(['changed my mind']);
  });
});

describe('dashboard insights', () => {
  const rows = [
    toRow(row({ id: 1, provider_name: 'A', status: 'completed', created_at: '2026-10-01T10:00:00' })),
    toRow(row({ id: 2, provider_name: 'A', status: 'cancelled', created_at: '2026-09-30T10:00:00' })),
    toRow(row({ id: 3, provider_name: 'B', status: 'pending', created_at: '2026-09-01T10:00:00' })),
    toRow(
      row({
        id: 4,
        provider_name: 'A',
        status: 'completed',
        service_layer: 'hotels',
        cancellation_reason: 'late',
      }),
    ),
  ];

  it('one search box matches user, provider, phone and reason', () => {
    expect(filterRows(rows, { ...NO_STAT_FILTERS, q: 'LATE' }).map((r) => r.id)).toEqual([4]);
    expect(filterRows(rows, { ...NO_STAT_FILTERS, q: 'b' }).map((r) => r.id)).toEqual([3]);
  });

  it('success rate in whole percent', () => {
    expect(successRate(countByStatus(rows))).toBe(50);
    expect(successRate({ success: 0, pending: 0, cancelled: 0 })).toBe(0);
  });

  it('counts the last days per status, oldest first, zeros included', () => {
    const days = dailyCounts(rows, 3, new Date(2026, 9, 1, 12));
    expect(days.map((d) => d.day)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
    expect(days[1]).toEqual({ day: '2026-09-30', success: 0, pending: 0, cancelled: 1 });
    expect(days[2].success).toBe(1);
  });

  it('ranks providers and services by rows, with successes', () => {
    expect(topBy(rows, 'provider', 5)).toEqual([
      { key: 'A', total: 3, success: 2 },
      { key: 'B', total: 1, success: 0 },
    ]);
    expect(topBy(rows, 'layer', 1)).toEqual([{ key: 'plumber', total: 3, success: 1 }]);
  });
});
