import type { AdminUser } from '@/api/adminUsers';
import type { ServiceRequest } from '@/api/requests';
import type { Role } from '@/types/auth';

// Pure rules behind the home page: what counts as "waiting for me". No React, so it is testable on its own.

export type DayPart = 'morning' | 'afternoon' | 'evening';

/** Greeting by local hour: before noon, until 6 pm, then evening. */
export function dayPart(hour: number): DayPart {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/** First word of the account name (the phone number when the account has no name). */
export function firstName(fullName: string | null | undefined, phone: string): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0];
  return first || phone;
}

export interface RequestSummary {
  /** Requests I sent that the provider has not answered yet. */
  waitingReply: number;
  /** Accepted requests I am part of (either side): a chat is open. */
  active: number;
  /** Requests waiting for MY answer as a provider. */
  incoming: number;
}

/** `GET /api/service-requests?user_id=` returns both sides of my requests; split them by who I am in each. */
export function summarizeRequests(requests: readonly ServiceRequest[], uid: number): RequestSummary {
  const s: RequestSummary = { waitingReply: 0, active: 0, incoming: 0 };
  for (const r of requests) {
    const iAmRequester = Number(r.user_id) === uid;
    const iAmProvider = Number(r.provider_user_id) === uid;
    if (r.status === 'accepted' && (iAmRequester || iAmProvider)) s.active += 1;
    if (r.status === 'pending' && r.contact_type === 'service_request') {
      if (iAmRequester) s.waitingReply += 1;
      else if (iAmProvider) s.incoming += 1;
    }
  }
  return s;
}

/** Accounts an admin still has to switch on: new registrations start inactive. */
export const countInactive = (users: readonly Pick<AdminUser, 'is_active'>[]) =>
  users.filter((u) => !u.is_active).length;

export type ProviderState = 'available' | 'busy' | 'frozen' | 'unlinked';

export type SignalId = 'incoming' | 'unseen' | 'rate' | 'waiting' | 'active' | 'unread' | 'inactive' | 'busy' | 'frozen';
export type SignalTone = 'warn' | 'ok' | 'info' | 'danger';
/** What pressing the row does; the component maps it to a link or a store action. */
export type SignalTarget = 'requests' | 'notifications' | 'admin-users' | 'provider-panel';

export interface Signal {
  id: SignalId;
  tone: SignalTone;
  target: SignalTarget;
  /** Missing for pure notices (the provider is hidden). */
  count?: number;
}

export interface SignalInput {
  role: Role;
  requests: RequestSummary;
  /** Requests with news I have not opened (local marks). */
  unseen: number;
  pendingRatings: number;
  unreadNotifications: number;
  inactiveUsers: number;
  provider: ProviderState | null;
}

/**
 * The "needs you" list, most urgent first. Zero counts are left out, so an empty list means nothing is waiting.
 * Provider-only and admin-only rows are added by role, whatever the other inputs hold.
 */
export function buildSignals(i: SignalInput): Signal[] {
  const out: Signal[] = [];
  const add = (s: Signal, on: boolean) => on && out.push(s);

  if (i.role === 'provider') {
    add({ id: 'incoming', tone: 'warn', target: 'requests', count: i.requests.incoming }, i.requests.incoming > 0);
    add({ id: 'frozen', tone: 'danger', target: 'provider-panel' }, i.provider === 'frozen');
    add({ id: 'busy', tone: 'warn', target: 'provider-panel' }, i.provider === 'busy');
  }
  if (i.role === 'admin')
    add({ id: 'inactive', tone: 'warn', target: 'admin-users', count: i.inactiveUsers }, i.inactiveUsers > 0);

  add({ id: 'unseen', tone: 'ok', target: 'requests', count: i.unseen }, i.unseen > 0);
  add({ id: 'rate', tone: 'warn', target: 'requests', count: i.pendingRatings }, i.pendingRatings > 0);
  add({ id: 'waiting', tone: 'info', target: 'requests', count: i.requests.waitingReply }, i.requests.waitingReply > 0);
  add({ id: 'active', tone: 'info', target: 'requests', count: i.requests.active }, i.requests.active > 0);
  add({ id: 'unread', tone: 'info', target: 'notifications', count: i.unreadNotifications }, i.unreadNotifications > 0);
  return out;
}
