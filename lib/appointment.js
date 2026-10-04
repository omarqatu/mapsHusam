// The time of a viewing / visit agreed on a request: a moment from now (with a few minutes' slack for a slow clock) up to
// 90 days ahead. `null` clears it. Pure, so it is unit-tested (lib/appointment.test.js).

export const APPOINTMENT_MAX_DAYS = 90;
const SLACK_MS = 10 * 60 * 1000;

/** → `{ value: Date | null }` or `{ error }` (Arabic, shown to the person). */
export function parseAppointment(raw, now = new Date()) {
    if (raw === null || raw === '') return { value: null };
    if (typeof raw !== 'string' || raw.length > 40) return { error: 'موعد غير صالح.' };
    const at = new Date(raw);
    if (Number.isNaN(at.getTime())) return { error: 'موعد غير صالح.' };
    if (at.getTime() < now.getTime() - SLACK_MS) return { error: 'الموعد لازم يكون بالمستقبل.' };
    if (at.getTime() > now.getTime() + APPOINTMENT_MAX_DAYS * 24 * 60 * 60 * 1000) {
        return { error: `الموعد لازم يكون خلال ${APPOINTMENT_MAX_DAYS} يوماً.` };
    }
    return { value: at };
}

/** The time as people here read it (the platform's time zone, whatever the server's is). */
export function appointmentText(at) {
    return new Intl.DateTimeFormat('ar-PS', {
        timeZone: 'Asia/Hebron',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: 'numeric',
        minute: '2-digit'
    }).format(at);
}
