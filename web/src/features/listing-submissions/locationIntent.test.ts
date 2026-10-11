import { describe, expect, it } from 'vitest';
import { isLatestLocationIntent } from './locationIntent';

describe('location picker intent', () => {
  it('ignores an automatic GPS result after the user has picked another location', () => {
    const automaticGpsIntent = 0;
    const userSelectedLocation = 1;

    expect(isLatestLocationIntent(automaticGpsIntent, userSelectedLocation)).toBe(false);
    expect(isLatestLocationIntent(userSelectedLocation, userSelectedLocation)).toBe(true);
  });
});
