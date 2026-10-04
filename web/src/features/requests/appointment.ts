import { REAL_ESTATE_LAYERS } from '@/features/map/config';
import { intlLocale } from '@/lib/format';

// The time of a visit / viewing on a request (server: lib/appointment.js — from now up to 90 days ahead).

export const APPOINTMENT_MAX_DAYS = 90;

/** A request on a property is a viewing (its wording, its rating after the visit). */
export const isViewingLayer = (layer: string) => REAL_ESTATE_LAYERS.some((l) => l.typeName === layer);

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → the `<input type="datetime-local">` value, in the device's time. */
export function toLocalInput(iso: string | Date): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The input's value → ISO; null when empty or not a time. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** 'past' / 'far' / null (fine) — the same bounds as the server, so the person is told before sending. */
export function appointmentProblem(iso: string, now = new Date()): 'past' | 'far' | null {
  const t = new Date(iso).getTime();
  if (t < now.getTime()) return 'past';
  if (t > now.getTime() + APPOINTMENT_MAX_DAYS * 86_400_000) return 'far';
  return null;
}

export type PresetKey = 'todayEvening' | 'tomorrowMorning' | 'tomorrowEvening' | 'dayAfterMorning';

/** One-tap times (what people usually agree on); today's evening only while it is still ahead. */
export function appointmentPresets(now = new Date()): { key: PresetKey; at: Date }[] {
  const at = (days: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const list: { key: PresetKey; at: Date }[] = [
    { key: 'todayEvening', at: at(0, 17) },
    { key: 'tomorrowMorning', at: at(1, 10) },
    { key: 'tomorrowEvening', at: at(1, 17) },
    { key: 'dayAfterMorning', at: at(2, 10) },
  ];
  return list.filter((p) => p.at.getTime() > now.getTime() + 30 * 60_000);
}

/** "Sunday 5 October · 17:30" in the reader's language. */
export function appointmentLabel(iso: string, lang: string) {
  const d = new Date(iso);
  const loc = intlLocale(lang);
  const day = d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${day} · ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}
