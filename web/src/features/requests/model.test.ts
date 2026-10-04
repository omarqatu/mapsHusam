import { beforeEach, describe, expect, it } from 'vitest';
import { countUnread, withPush, withRead, type AppNotification } from '@/api/notifications';
import { contactFor, isCancellable, mergeMessages, normalizeWhatsapp, otherPartyName, roleIn } from './model';
import { useUnseen } from './unseen';

describe('request rules', () => {
  it('finds the side of the user and the other party', () => {
    expect(roleIn({ provider_user_id: 5 }, 5)).toBe('provider');
    expect(roleIn({ provider_user_id: 5 }, 6)).toBe('user');
    const r = { provider_name: 'P', user_name: 'U', contact_type: 'service_request' } as never;
    expect(otherPartyName(r, 'user')).toBe('P');
    expect(otherPartyName(r, 'provider')).toBe('U');
  });
  it('only open requests can be cancelled', () => {
    expect(isCancellable('pending')).toBe(true);
    expect(isCancellable('accepted')).toBe(true);
    expect(isCancellable('completed')).toBe(false);
    expect(isCancellable('rejected')).toBe(false);
  });
  it('normalizes Palestinian numbers', () => {
    expect(normalizeWhatsapp('0591234567')).toBe('970591234567');
    expect(normalizeWhatsapp('+970 59 123 4567')).toBe('970591234567');
    expect(normalizeWhatsapp('00972591234567')).toBe('972591234567');
    expect(normalizeWhatsapp('')).toBe('');
  });
  it('picks the other side numbers with the legacy fallbacks', () => {
    const c = contactFor('user', { providerPhone: '0591234567', providerWhatsapp: '' } as never);
    expect(c).toMatchObject({ phone: '0591234567', whatsappDigits: '970591234567' });
    expect(contactFor('provider', undefined).phone).toBe('');
  });
  it('merges messages without duplicates', () => {
    expect(mergeMessages([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]).map((m) => m.id)).toEqual([1, 2, 3]);
  });
});

describe('notification list', () => {
  const n = (id: number, is_read: boolean | null): AppNotification =>
    ({ id, title: 't', message: 'm', type: 'info', is_read, created_at: '' });
  it('counts unread and applies push / read', () => {
    const list = [n(1, false), n(2, true), n(3, null)];
    expect(countUnread(list)).toBe(2);
    expect(withRead(list, [1]).map((x) => x.is_read)).toEqual([true, true, null]);
    const pushed = withPush(list, { id: 3, title: 'x', message: 'y', type: 'info', created_at: '' });
    expect(pushed[0]).toMatchObject({ id: 3, is_read: false });
    expect(pushed).toHaveLength(3);
  });
  it('keeps at most 50', () => {
    const many = Array.from({ length: 50 }, (_, i) => n(i + 1, true));
    expect(withPush(many, { id: 99, title: '', message: '', type: 'info', created_at: '' })).toHaveLength(50);
  });
});

describe('unseen marks', () => {
  beforeEach(() => {
    localStorage.clear();
    useUnseen.getState().hydrate(7);
  });
  it('stores per user and survives a reload', () => {
    useUnseen.getState().add(1);
    useUnseen.getState().add(1);
    useUnseen.getState().add(2);
    useUnseen.getState().hydrate(7);
    expect(useUnseen.getState().ids).toEqual([1, 2]);
    useUnseen.getState().hydrate(8);
    expect(useUnseen.getState().ids).toEqual([]);
    useUnseen.getState().hydrate(7);
    useUnseen.getState().clear(1);
    expect(useUnseen.getState().ids).toEqual([2]);
    useUnseen.getState().clear();
    expect(localStorage.getItem('svc_unseen_7')).toBeNull();
  });
});
