import { describe, expect, it } from 'vitest';
import {
  NO_CONTACT,
  hasContact,
  isValidNumber,
  parseContact,
  serializeContact,
  telUrl,
  tidyNumber,
  whatsappDigits,
  whatsappUrl,
} from './model';

describe('platform contact numbers', () => {
  it('accepts local and international numbers, and empty (= not set)', () => {
    for (const ok of ['', '0599123456', '059 912-3456', '+970599123456', '00970599123456', '022345678'])
      expect(isValidNumber(ok), ok).toBe(true);
    for (const bad of ['abc', '123', '05991234567890123', '059-9x', '+', '(02) 234'])
      expect(isValidNumber(bad), bad).toBe(false);
  });

  it('tidies what is stored', () => {
    expect(tidyNumber(' 059 912-3456 ')).toBe('0599123456');
    expect(tidyNumber('00970599123456')).toBe('+970599123456');
    expect(tidyNumber('+970 599 123 456')).toBe('+970599123456');
    expect(tidyNumber('')).toBe('');
  });

  it('builds a wa.me link with the country code and no plus', () => {
    expect(whatsappDigits('0599123456')).toBe('970599123456');
    expect(whatsappDigits('+972501234567')).toBe('972501234567');
    expect(whatsappUrl({ whatsapp: '0599123456', phone: '' })).toBe('https://wa.me/970599123456');
    expect(whatsappUrl({ whatsapp: '0599123456', phone: '' }, 'مرحبا؟')).toContain('?text=');
    expect(whatsappUrl(NO_CONTACT)).toBeNull();
  });

  it('builds a tel link, or none', () => {
    expect(telUrl({ whatsapp: '', phone: '022 345 678' })).toBe('tel:022345678');
    expect(telUrl(NO_CONTACT)).toBeNull();
  });

  it('reads the stored JSON and treats garbage as not set', () => {
    expect(parseContact(serializeContact({ whatsapp: '0599 123 456', phone: '022345678' }))).toEqual({
      whatsapp: '0599123456',
      phone: '022345678',
    });
    for (const raw of [null, undefined, '', 'nope', '[]', 'null', '"x"']) expect(parseContact(raw)).toEqual(NO_CONTACT);
    // an invalid number is dropped, the valid one kept
    expect(parseContact(JSON.stringify({ whatsapp: 'xyz', phone: '022345678' }))).toEqual({ whatsapp: '', phone: '022345678' });
    expect(hasContact(NO_CONTACT)).toBe(false);
  });
});
