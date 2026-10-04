import { describe, expect, it } from 'vitest';
import { availability } from './featureModel';

describe('availability (listing status + open hours)', () => {
  it('a listing marked unavailable or withdrawn says so, whatever the hours', () => {
    expect(availability({ status: 1, auto_status: 1 })).toBe('unavailable');
    expect(availability({ status: '2', auto_status: 0 })).toBe('withdrawn');
  });
  it('an available listing is open or closed by its hours', () => {
    expect(availability({ status: 0, auto_status: 0 })).toBe('open');
    expect(availability({ status: 0, auto_status: 1 })).toBe('closed');
  });
  it('nothing known → nothing shown', () => {
    expect(availability({ status: 0 })).toBeNull();
    expect(availability({})).toBeNull();
  });
});
