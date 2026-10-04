import { describe, expect, it } from 'vitest';
import { isLocalMobile, toWhatsappNumber } from './phone';

describe('phone helpers', () => {
  it('accepts only 05 + 8 digits', () => {
    expect(isLocalMobile('0598512667')).toBe(true);
    expect(isLocalMobile(' 0598512667 ')).toBe(true);
    expect(isLocalMobile('598512667')).toBe(false);
    expect(isLocalMobile('05985126678')).toBe(false);
    expect(isLocalMobile('0498512667')).toBe(false);
    expect(isLocalMobile('05985x2667')).toBe(false);
  });
  it('builds the WhatsApp number from the prefix and the local number', () => {
    expect(toWhatsappNumber('970', '0598512667')).toBe('+970598512667');
    expect(toWhatsappNumber('972', '0598512667')).toBe('+972598512667');
  });
});
