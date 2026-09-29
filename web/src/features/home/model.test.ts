import { describe, expect, it } from 'vitest';
import type { ServiceRequest } from '@/api/requests';
import { buildSignals, countInactive, countUnseen, dayPart, firstName, summarizeRequests, type SignalInput } from './model';

const req = (over: Partial<ServiceRequest>): ServiceRequest =>
  ({
    id: 1,
    user_id: 10,
    provider_user_id: 20,
    status: 'pending',
    contact_type: 'service_request',
    ...over,
  }) as ServiceRequest;

const none = { waitingReply: 0, active: 0, incoming: 0 };
const base: SignalInput = {
  role: 'user',
  requests: none,
  unseen: 0,
  pendingRatings: 0,
  unreadNotifications: 0,
  inactiveUsers: 0,
  provider: null,
};

describe('greeting', () => {
  it('splits the day at noon and six', () => {
    expect([0, 11, 12, 17, 18, 23].map(dayPart)).toEqual([
      'morning',
      'morning',
      'afternoon',
      'afternoon',
      'evening',
      'evening',
    ]);
  });
  it('uses the first word of the name, the phone when there is none', () => {
    expect(firstName('  أحمد  قطوع ', '0590000003')).toBe('أحمد');
    expect(firstName(null, '0590000003')).toBe('0590000003');
    expect(firstName('   ', '0590000003')).toBe('0590000003');
  });
});

describe('summarizeRequests', () => {
  it('counts each request on the side I am on', () => {
    const list = [
      req({ id: 1, user_id: 10, provider_user_id: 20 }), // I sent it, no answer yet
      req({ id: 2, user_id: 30, provider_user_id: 10 }), // sent to me
      req({ id: 3, user_id: 10, provider_user_id: 20, status: 'accepted' }),
      req({ id: 4, user_id: 30, provider_user_id: 10, status: 'accepted' }),
      req({ id: 5, user_id: 10, provider_user_id: 20, status: 'completed' }),
      req({ id: 6, user_id: 10, provider_user_id: 20, status: 'cancelled' }),
      req({ id: 7, user_id: 10, provider_user_id: 20, status: 'pending', contact_type: 'call' }),
    ];
    expect(summarizeRequests(list, 10)).toEqual({ waitingReply: 1, active: 2, incoming: 1 });
  });
  it('is empty for no requests', () => expect(summarizeRequests([], 10)).toEqual(none));
});

describe('countUnseen', () => {
  const list = [
    req({ id: 1, user_id: 30, provider_user_id: 10, status: 'pending' }), // waiting for my answer: the incoming row
    req({ id: 2, user_id: 30, provider_user_id: 10, status: 'accepted' }),
    req({ id: 3, user_id: 10, provider_user_id: 20, status: 'pending' }), // mine, waiting: a real mark counts
  ];
  it('skips requests already shown as incoming and marks of requests that are gone', () => {
    expect(countUnseen([1, 2, 3, 99], list, 10)).toBe(2);
  });
  it('is zero before the list has loaded', () => expect(countUnseen([1, 2], [], 10)).toBe(0));
});

describe('countInactive', () => {
  it('counts accounts that are not active', () => {
    expect(countInactive([{ is_active: true }, { is_active: false }, { is_active: false }])).toBe(2);
  });
});

describe('buildSignals', () => {
  it('is empty when nothing is waiting', () => {
    expect(buildSignals(base)).toEqual([]);
    expect(buildSignals({ ...base, role: 'admin' })).toEqual([]);
    expect(buildSignals({ ...base, role: 'provider', provider: 'available' })).toEqual([]);
  });

  it('shows the requester side to a normal user, most urgent first', () => {
    const s = buildSignals({
      ...base,
      requests: { waitingReply: 2, active: 1, incoming: 5 },
      unseen: 1,
      pendingRatings: 1,
      unreadNotifications: 3,
      inactiveUsers: 9,
    });
    // A plain user never sees the provider queue or the admin count, even if the data had them.
    expect(s.map((x) => x.id)).toEqual(['unseen', 'rate', 'waiting', 'active', 'unread']);
  });

  it('puts the provider queue first, then the status notice', () => {
    const s = buildSignals({
      ...base,
      role: 'provider',
      requests: { waitingReply: 0, active: 0, incoming: 2 },
      provider: 'busy',
      unreadNotifications: 1,
    });
    expect(s.map((x) => [x.id, x.count])).toEqual([
      ['incoming', 2],
      ['busy', undefined],
      ['unread', 1],
    ]);
    expect(s[1].target).toBe('provider-panel');
  });

  it('flags a frozen provider account as danger', () => {
    expect(buildSignals({ ...base, role: 'provider', provider: 'frozen' })).toEqual([
      { id: 'frozen', tone: 'danger', target: 'provider-panel' },
    ]);
  });

  it('tells an admin about accounts awaiting activation', () => {
    expect(buildSignals({ ...base, role: 'admin', inactiveUsers: 4 })).toEqual([
      { id: 'inactive', tone: 'warn', target: 'admin-users', count: 4 },
    ]);
  });
});
