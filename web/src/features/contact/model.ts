// The platform's own contact numbers (WhatsApp + phone), stored by the admin in platform_content under CONTACT_KEY
// as JSON. Both are optional: an empty number simply means "no such button".

export const CONTACT_KEY = 'settings.contact';

export interface PlatformContact {
  whatsapp: string;
  phone: string;
}

export const NO_CONTACT: PlatformContact = { whatsapp: '', phone: '' };

const digits = (v: string) => v.replace(/\D/g, '');

/** Local (05xxxxxxxx / 0xxxxxxxx) or international (+970… / 00970…) numbers, 8–15 digits, optional spaces and dashes. */
export function isValidNumber(raw: string): boolean {
  const v = raw.trim();
  if (!v) return true; // empty = not set
  if (!/^\+?[\d\s-]+$/.test(v)) return false;
  const n = digits(v);
  return n.length >= 8 && n.length <= 15;
}

/** What is stored: the number as typed, tidied (spaces and dashes out, `00` → `+`). */
export function tidyNumber(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  const d = digits(v);
  if (v.startsWith('+')) return `+${d}`;
  if (d.startsWith('00')) return `+${d.slice(2)}`;
  return d;
}

/** wa.me wants country code + number, no `+`: a local Palestinian number (05…) becomes 9705… */
export function whatsappDigits(raw: string): string {
  const t = tidyNumber(raw);
  if (!t) return '';
  if (t.startsWith('+')) return t.slice(1);
  return t.startsWith('0') ? `970${t.slice(1)}` : t;
}

export function whatsappUrl(c: PlatformContact, text?: string): string | null {
  const n = whatsappDigits(c.whatsapp);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function telUrl(c: PlatformContact): string | null {
  const n = tidyNumber(c.phone);
  return n ? `tel:${n}` : null;
}

/** Reads the stored JSON; anything wrong (missing, garbage, invalid number) counts as "not set". */
export function parseContact(raw: string | null | undefined): PlatformContact {
  if (!raw) return NO_CONTACT;
  try {
    const o: unknown = JSON.parse(raw);
    if (typeof o !== 'object' || o === null) return NO_CONTACT;
    const pick = (v: unknown) => (typeof v === 'string' && isValidNumber(v) ? tidyNumber(v) : '');
    const r = o as Record<string, unknown>;
    return { whatsapp: pick(r.whatsapp), phone: pick(r.phone) };
  } catch {
    return NO_CONTACT;
  }
}

export const serializeContact = (c: PlatformContact): string =>
  JSON.stringify({ whatsapp: tidyNumber(c.whatsapp), phone: tidyNumber(c.phone) });

export const sameContact = (a: PlatformContact, b: PlatformContact) =>
  tidyNumber(a.whatsapp) === tidyNumber(b.whatsapp) && tidyNumber(a.phone) === tidyNumber(b.phone);

export const hasContact = (c: PlatformContact) => !!(c.whatsapp || c.phone);
