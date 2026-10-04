import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONTACT,
  cleanPhone,
  parseContact,
  safeUrl,
  serializeContact,
  whatsappDigits,
} from './model';

describe('platform contact settings', () => {
  it('a local mobile goes to WhatsApp as a Palestinian number; international ones keep their code', () => {
    expect(whatsappDigits('0599 123 456')).toBe('970599123456');
    expect(whatsappDigits('+972 52 123 4567')).toBe('972521234567');
    expect(whatsappDigits('00970599123456')).toBe('970599123456');
    expect(whatsappDigits('12')).toBe('');
  });
  it('only http(s) links survive (no javascript: link from a typo)', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('https://www.instagram.com/x')).toBe('https://www.instagram.com/x');
    expect(safeUrl('instagram.com/x')).toBe('');
  });
  it('reads a stored value field by field, dropping what is invalid, and keeps the default when there is none', () => {
    expect(parseContact(null)).toEqual(DEFAULT_CONTACT);
    expect(parseContact('nope')).toEqual(DEFAULT_CONTACT);
    const c = parseContact(
      JSON.stringify({
        phone: '02-295 1234',
        whatsapp: '0599123456',
        email: 'bad',
        social: { youtube: 'ftp://x', linkedin: 'https://l.in/p' },
      }),
    );
    expect(c.phone).toBe('022951234');
    expect(c.whatsapp).toBe('0599123456');
    expect(c.email).toBe('');
    expect(c.social).toEqual({ facebook: '', instagram: '', youtube: '', linkedin: 'https://l.in/p' });
    expect(parseContact(serializeContact(c))).toEqual(c);
  });
  it('a phone is 7–15 digits with at most one leading +', () => {
    expect(cleanPhone('+970 2 295 1234')).toBe('+97022951234');
    expect(cleanPhone('12+34')).toBe('');
  });
});
