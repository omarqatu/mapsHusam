import { describe, expect, it } from 'vitest';
import {
  appointmentPresets,
  appointmentProblem,
  fromLocalInput,
  isViewingLayer,
  toLocalInput,
} from './appointment';

describe('appointment', () => {
  it('a property request is a viewing', () => {
    expect(isViewingLayer('ApartRent')).toBe(true);
    expect(isViewingLayer('LandSale')).toBe(true);
    expect(isViewingLayer('plumber')).toBe(false);
  });

  it('goes to and from the datetime input in local time', () => {
    const local = '2026-10-05T17:30';
    const iso = fromLocalInput(local)!;
    expect(toLocalInput(iso)).toBe(local);
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('nope')).toBeNull();
  });

  it('refuses the past and more than 90 days ahead', () => {
    const now = new Date('2026-10-04T10:00:00Z');
    expect(appointmentProblem('2026-10-04T09:00:00Z', now)).toBe('past');
    expect(appointmentProblem('2027-02-01T10:00:00Z', now)).toBe('far');
    expect(appointmentProblem('2026-10-06T10:00:00Z', now)).toBeNull();
  });

  it('offers today’s evening only while it is ahead', () => {
    const morning = new Date(2026, 9, 4, 9, 0);
    expect(appointmentPresets(morning).map((p) => p.key)).toEqual([
      'todayEvening',
      'tomorrowMorning',
      'tomorrowEvening',
      'dayAfterMorning',
    ]);
    const night = new Date(2026, 9, 4, 21, 0);
    expect(appointmentPresets(night)[0]).toMatchObject({ key: 'tomorrowMorning' });
    expect(appointmentPresets(night)[0].at.getHours()).toBe(10);
  });
});
