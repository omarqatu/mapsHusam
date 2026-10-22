import { intlLocale, parseServerDate } from '@/lib/format';
import type { Props } from '../map/popup/featureModel';
import { distanceToResult } from '../map/search/nearby';
import type { SearchResult } from '../map/search/results';

/** Price per square metre, when both are known (a land's or a flat's most compared number). */
export function pricePerMeter(props: Props): number | null {
  const price = Number(props.price);
  const area = Number(props.area);
  return Number.isFinite(price) && Number.isFinite(area) && price > 0 && area > 0
    ? Math.round(price / area)
    : null;
}

export const SIMILAR_COUNT = 10;

/** The closest listings of the same type, the listing itself left out, each with its distance. */
export function closestOthers(rows: SearchResult[], of: SearchResult, count = SIMILAR_COUNT): SearchResult[] {
  return rows
    .filter((r) => r.key !== of.key)
    .map((r) => ({ r, d: distanceToResult(r, of.center) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(({ r, d }) => ({ ...r, distance: d }));
}

/** `start_date` / `updated_at` as a date, or null when missing, unreadable or in the future (bad data). */
export function listingDate(value: unknown, now = Date.now()): Date | null {
  const d = parseServerDate(typeof value === 'string' ? value : null);
  return d && d.getTime() <= now + 60_000 ? d : null;
}

/** "Posted 3 days ago" in the UI language: days under a month, then months, then years ("today" for under a day). */
export function postedAgo(date: Date, lang: string, now = Date.now()): string {
  const days = Math.floor(Math.max(0, now - date.getTime()) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(lang), { numeric: 'auto' });
  if (days < 31) return rtf.format(-days, 'day');
  if (days < 365) return rtf.format(-Math.floor(days / 30), 'month');
  return rtf.format(-Math.floor(days / 365), 'year');
}
