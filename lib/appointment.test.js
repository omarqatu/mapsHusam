// node --test lib/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appointmentText, parseAppointment } from './appointment.js';

const now = new Date('2026-10-04T10:00:00Z');

test('an appointment is a time from now up to 90 days ahead; empty clears it', () => {
    assert.deepEqual(parseAppointment('2026-10-05T15:30:00Z', now).value, new Date('2026-10-05T15:30:00Z'));
    assert.deepEqual(parseAppointment(null, now), { value: null });
    assert.deepEqual(parseAppointment('', now), { value: null });
    assert.ok(parseAppointment('2026-10-04T09:55:00Z', now).value, 'a few minutes of clock slack');
    assert.ok(parseAppointment('2026-10-03T10:00:00Z', now).error);
    assert.ok(parseAppointment('2027-02-01T10:00:00Z', now).error);
    assert.ok(parseAppointment('tomorrow', now).error);
    assert.ok(parseAppointment(1759600000000, now).error);
});

test('the time is written in the platform time zone', () => {
    // 15:30 UTC = 18:30 in Palestine (summer time)
    assert.match(appointmentText(new Date('2026-10-05T15:30:00Z')), /6:30|٦:٣٠/);
});
