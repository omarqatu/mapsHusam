// How to reach the platform itself (not a listing): phone, WhatsApp, email and its pages on social networks.
// Stored by the admin as one JSON value under `settings.contact` (platform_content); shown in the footer and in the
// "contact us" page. Every field is optional: an empty one is simply not shown.

export const CONTACT_KEY = 'settings.contact';

export const SOCIAL_KEYS = ['facebook', 'instagram', 'youtube', 'linkedin'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export interface PlatformContact {
  phone: string;
  whatsapp: string;
  email: string;
  social: Record<SocialKey, string>;
}

/** Until the admin saves one: the platform's Facebook page (the only address the legacy footer had). */
export const DEFAULT_CONTACT: PlatformContact = {
  phone: '',
  whatsapp: '',
  email: '',
  social: {
    facebook: 'https://www.facebook.com/MapServesPalestine',
    instagram: '',
    youtube: '',
    linkedin: '',
  },
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Only http(s) addresses are kept (a `javascript:` link typed by mistake must never become a link). */
export function safeUrl(v: string): string {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch {
    return '';
  }
}

/** Phone as typed → digits with an optional leading +, or '' when it cannot be a phone number. */
export function cleanPhone(v: string): string {
  const cleaned = v.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  const digits = cleaned.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? cleaned : '';
}

/**
 * WhatsApp needs the international number. A local mobile (05…) is a Palestinian one (+970), as everywhere else in
 * the app; 00 / + prefixes are dropped.
 */
export function whatsappDigits(v: string): string {
  let d = v.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (/^05\d{8}$/.test(d)) d = `970${d.slice(1)}`;
  return d.length >= 8 && d.length <= 15 ? d : '';
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function parseContact(raw: string | null | undefined): PlatformContact {
  if (!raw) return DEFAULT_CONTACT;
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_CONTACT;
    data = parsed as Record<string, unknown>;
  } catch {
    return DEFAULT_CONTACT;
  }
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<
    string,
    unknown
  >;
  const email = str(data.email, 120);
  return {
    phone: cleanPhone(str(data.phone, 30)),
    whatsapp: whatsappDigits(str(data.whatsapp, 30)) ? str(data.whatsapp, 30) : '',
    email: isEmail(email) ? email : '',
    social: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, safeUrl(str(social[k], 300))])) as Record<
      SocialKey,
      string
    >,
  };
}

export const serializeContact = (c: PlatformContact) =>
  JSON.stringify({ phone: c.phone, whatsapp: c.whatsapp, email: c.email, social: c.social });

export const hasDirectContact = (c: PlatformContact) => !!(c.phone || c.whatsapp || c.email);
