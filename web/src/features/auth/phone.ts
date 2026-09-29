/** Palestinian mobile as the server and legacy both require it: 10 digits starting with 05. */
export const LOCAL_MOBILE = /^05\d{8}$/;

export const WHATSAPP_PREFIXES = ['970', '972'] as const;
export type WhatsappPrefix = (typeof WHATSAPP_PREFIXES)[number];

export const isLocalMobile = (phone: string) => LOCAL_MOBILE.test(phone.trim());

/** `0598512667` + `970` → `+970598512667` (legacy register form). */
export function toWhatsappNumber(prefix: WhatsappPrefix, localPhone: string): string {
  return `+${prefix}${localPhone.trim().substring(1)}`;
}

export const MIN_PASSWORD_LENGTH = 6;
