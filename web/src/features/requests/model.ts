import type { ContactNumbers, RequestRole, RequestStatus, ServiceRequest } from '@/api/requests';

// Pure rules behind the requests UI (legacy js/service-chat.js), testable without React.

/** Which side of a request the signed-in user is on. */
export function roleIn(r: Pick<ServiceRequest, 'provider_user_id'>, uid: number): RequestRole {
  return Number(r.provider_user_id) === uid ? 'provider' : 'user';
}

/** `call` / `whatsapp` rows are the contact log (already completed, never a chat). */
export const isDirectContact = (r: Pick<ServiceRequest, 'contact_type'>) =>
  r.contact_type === 'call' || r.contact_type === 'whatsapp';

/** The other party's name; `null` when the server sent none (the UI then shows a generic label). */
export function otherPartyName(r: ServiceRequest, role: RequestRole): string | null {
  if (isDirectContact(r) || role === 'user') return r.provider_name || r.provider_full_name || null;
  return r.user_name || r.requester_name || null;
}

/** A request can still be cancelled while it is open (server: pending / accepted only). */
export const isCancellable = (status: RequestStatus) => status === 'pending' || status === 'accepted';

/** Has this side already pressed "agreed"? (Server flags, so it survives closing the chat.) */
export const hasConfirmed = (r: Pick<ServiceRequest, 'user_confirmed' | 'provider_confirmed'>, role: RequestRole) =>
  role === 'user' ? r.user_confirmed : r.provider_confirmed;

const digits = (v: string) => v.replace(/\D/g, '');

/** WhatsApp number as international digits (legacy normalizeWhatsappNumber: Palestine 970 by default). */
export function normalizeWhatsapp(raw: string | null | undefined): string {
  if (!raw) return '';
  let d = digits(String(raw));
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if ((d.startsWith('970') || d.startsWith('972')) && d.length >= 12) return d.slice(0, 12);
  if (d.length === 10 && d.startsWith('0')) return `970${d.slice(1)}`;
  if (d.length === 9 && d.startsWith('5')) return `970${d}`;
  return d;
}

/** Local dial number from a WhatsApp number (legacy deriveLocalPhoneFromWhatsapp). */
export function localPhoneFromWhatsapp(raw: string | null | undefined): string {
  const n = normalizeWhatsapp(raw);
  if (!n) return '';
  if ((n.startsWith('970') || n.startsWith('972')) && n.length === 12 && n[3] === '5') return `0${n.slice(3)}`;
  if (n.length === 10 && n.startsWith('0')) return n;
  if (n.length === 9 && n.startsWith('5')) return `0${n}`;
  return n;
}

export interface ContactInfo {
  phone: string;
  /** Raw number as stored, shown on the button. */
  whatsapp: string;
  /** Normalized digits for the wa.me style link. */
  whatsappDigits: string;
}

/**
 * The other side's numbers once the agreement is complete. Legacy fallbacks kept: no WhatsApp → the phone;
 * no phone → derived from the WhatsApp number.
 */
export function contactFor(role: RequestRole, n: ContactNumbers | undefined): ContactInfo {
  const phoneRaw = (role === 'user' ? n?.providerPhone : n?.userPhone)?.trim() ?? '';
  const waRaw = (role === 'user' ? n?.providerWhatsapp : n?.userWhatsapp)?.trim() || phoneRaw;
  const whatsappDigits = normalizeWhatsapp(waRaw);
  return { phone: phoneRaw || localPhoneFromWhatsapp(waRaw), whatsapp: waRaw, whatsappDigits };
}

/** Messages of the chat, without duplicates (a pushed message may also arrive with the next refresh). */
export function mergeMessages<T extends { id: number }>(a: readonly T[], b: readonly T[]): T[] {
  const seen = new Set<number>();
  return [...a, ...b].filter((m) => !seen.has(m.id) && !!seen.add(m.id));
}
