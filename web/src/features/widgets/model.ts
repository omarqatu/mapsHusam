import type { CityPoint } from '@/api/external';
import type { WidgetGroupKey, WidgetItem } from '@/api/adminWidgets';
import type { MarketRates } from '@/api/market';
import type { WidgetsData } from '@/api/widgets';
import { toTextItem } from '@/features/admin-widgets/model';
import { matchesQuery } from '@/features/map/extras/status';
import { intlLocale } from '@/lib/format';

// Pure logic of the live-information pages: the ten cards, the West-Bank cities of the forecast, reading the answers of
// Open-Meteo / Aladhan, prayer times, hijri date, events and the items of the ticker. No React in here.

// ---- the cards ----

export type PortalTab = 'prices' | 'today' | 'status';
export const PORTAL_TABS: readonly PortalTab[] = ['prices', 'today', 'status'];

/** Card ids double as the `?card=` deep link (legacy: `data-widgets-card="portal-…-card"`). */
export const CARD_IDS = [
  'currency',
  'gold',
  'fuel',
  'transport-inter',
  'transport-intra',
  'weather',
  'prayer',
  'calendar',
  'road-status',
  'fuel-status',
] as const;
export type CardId = (typeof CARD_IDS)[number];

export const CARD_TAB: Record<CardId, PortalTab> = {
  currency: 'prices',
  gold: 'prices',
  fuel: 'prices',
  'transport-inter': 'prices',
  'transport-intra': 'prices',
  weather: 'today',
  prayer: 'today',
  calendar: 'today',
  'road-status': 'status',
  'fuel-status': 'status',
};

/** The manually edited groups behind the price cards. */
export type PriceCardId = Extract<
  CardId,
  'currency' | 'gold' | 'fuel' | 'transport-inter' | 'transport-intra'
>;
export const PRICE_GROUP: Record<PriceCardId, WidgetGroupKey> = {
  currency: 'currency',
  gold: 'gold',
  fuel: 'fuel',
  'transport-inter': 'transport_inter_city',
  'transport-intra': 'transport_intra_city',
};

export const isCardId = (v: string | null | undefined): v is CardId =>
  !!v && (CARD_IDS as readonly string[]).includes(v);

// ---- groups from GET /api/widgets-data ----

/** Rows of a group as text (numbers / nulls of older saves are normalised); a missing or malformed group is empty. */
export function groupItems(data: WidgetsData | undefined, key: WidgetGroupKey): WidgetItem[] {
  const items = data?.groups?.[key]?.items;
  return Array.isArray(items) ? items.map(toTextItem).filter((i) => Object.keys(i).length > 0) : [];
}

export const groupUpdatedAt = (data: WidgetsData | undefined, key: WidgetGroupKey): string | null =>
  data?.groups?.[key]?.updated_at ?? null;

/** Search box of a card: every typed word must appear in the row's text (Arabic letter variants folded). */
export function filterRows(rows: readonly WidgetItem[], query: string): WidgetItem[] {
  return rows.filter((r) =>
    matchesQuery([r.label, r.code, r.unit, r.value, r.condition].filter(Boolean).join(' '), query),
  );
}

/** Values are free text ("28 - الحافلة 18.5"); they are shown as typed, trimmed. */
export const displayValue = (v: string | undefined): string => (v ?? '').trim();

// ---- currency / fuel icons (legacy picked by the row's code / id) ----

export type FuelKind = 'petrol' | 'diesel' | 'gas';
export function fuelKind(item: WidgetItem): FuelKind {
  const id = (item.id ?? '').toLowerCase();
  if (id.includes('diesel')) return 'diesel';
  if (id.includes('gas')) return 'gas';
  return 'petrol';
}

/** Short badge for a currency row: the first three-letter code of `code` ("USD/ILS" → "USD"), else "¤". */
export function currencyBadge(item: WidgetItem): string {
  const m = /[A-Za-z]{3}/.exec(item.code ?? '');
  return m ? m[0].toUpperCase() : '¤';
}

// ---- weather ----

export const FORECAST_DAYS = 3;

/** The eleven cities of the legacy forecast (`WIDGETS_API_CONFIG.weather.cities`). Names live in `widgets.cities.<id>`. */
export const CITIES: readonly CityPoint[] = [
  { id: 'ramallah', lat: 31.9038, lon: 35.2034 },
  { id: 'jerusalem', lat: 31.7683, lon: 35.2137 },
  { id: 'hebron', lat: 31.5326, lon: 35.0998 },
  { id: 'bethlehem', lat: 31.7054, lon: 35.2024 },
  { id: 'jericho', lat: 31.8567, lon: 35.4436 },
  { id: 'nablus', lat: 32.2211, lon: 35.2544 },
  { id: 'jenin', lat: 32.4611, lon: 35.3007 },
  { id: 'tulkarm', lat: 32.3089, lon: 35.0286 },
  { id: 'tubas', lat: 32.3211, lon: 35.3689 },
  { id: 'salfit', lat: 32.0836, lon: 35.1797 },
  { id: 'qalqilya', lat: 32.1894, lon: 34.9706 },
];

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'showers' | 'storm';

/** WMO weather code → the icon / label group (legacy `pickWeatherIconByCode`, same ranges). */
export function weatherKind(code: unknown): WeatherKind {
  const n = typeof code === 'number' ? code : parseInt(String(code), 10);
  if (Number.isNaN(n)) return 'partly';
  if (n === 0) return 'clear';
  if (n === 1 || n === 2) return 'partly';
  if (n === 3) return 'cloudy';
  if (n >= 45 && n <= 48) return 'fog';
  if (n >= 51 && n <= 67) return 'rain';
  if (n >= 71 && n <= 77) return 'snow';
  if (n >= 80 && n <= 82) return 'showers';
  if (n >= 95) return 'storm';
  return 'partly';
}

export interface ForecastDay {
  /** `YYYY-MM-DD` in the city's own timezone. */
  date: string;
  /** Daytime high / night low, whole °C. */
  max: number;
  min: number;
  kind: WeatherKind;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Open-Meteo answers one object for one city and an array for several (same order as asked); a city whose block is
 * missing or malformed gets no days (legacy did the same). Returns city id → days.
 */
export function parseForecast(
  raw: unknown,
  cities: readonly CityPoint[] = CITIES,
): Record<string, ForecastDay[]> {
  const blocks = Array.isArray(raw) ? raw : [raw];
  const out: Record<string, ForecastDay[]> = {};
  cities.forEach((city, i) => {
    const daily = (blocks[i] as { daily?: Record<string, unknown> } | undefined)?.daily;
    const time = Array.isArray(daily?.time) ? (daily.time as unknown[]) : [];
    const days: ForecastDay[] = [];
    time.forEach((date, d) => {
      const max = num((daily?.temperature_2m_max as unknown[] | undefined)?.[d]);
      const min = num((daily?.temperature_2m_min as unknown[] | undefined)?.[d]);
      if (typeof date !== 'string' || max === null || min === null) return;
      days.push({
        date,
        max: Math.round(max),
        min: Math.round(min),
        kind: weatherKind((daily?.weathercode as unknown[] | undefined)?.[d]),
      });
    });
    out[city.id] = days;
  });
  return out;
}

export interface CityWeather {
  id: string;
  /** Name typed by the admin (used for cities the forecast does not know; known ones use the translated name). */
  label?: string;
  /** What the admin typed for "now" (`temp`, `humidity`, `wind`, `condition`); every part optional. */
  current?: { temp?: string; humidity?: string; wind?: string; condition?: string };
  days: ForecastDay[];
}

/**
 * The cities to show: the admin's `weather` rows first (their order, their "now" values), then the rest of the forecast
 * cities. A forecast city the admin also has gets both. Legacy lost the admin rows (they replaced the forecast).
 */
export function mergeWeather(
  admin: readonly WidgetItem[],
  forecast: Record<string, ForecastDay[]> | undefined,
): CityWeather[] {
  const out: CityWeather[] = [];
  const seen = new Set<string>();
  for (const row of admin) {
    const id = row.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const current = {
      temp: row.temp?.trim() || undefined,
      humidity: row.humidity?.trim() || undefined,
      wind: row.wind?.trim() || undefined,
      condition: row.condition?.trim() || undefined,
    };
    const has = Object.values(current).some(Boolean);
    out.push({
      id,
      label: row.label?.trim() || undefined,
      current: has ? current : undefined,
      days: forecast?.[id] ?? [],
    });
  }
  for (const city of CITIES) {
    if (seen.has(city.id) || !forecast) continue;
    out.push({ id: city.id, days: forecast[city.id] ?? [] });
  }
  return out;
}

export const isKnownCity = (id: string) => CITIES.some((c) => c.id === id);

/**
 * What the ticker and the landing strip say about a city: today's high and low from the live forecast ("27°/15°"), so it is
 * never a single number that could be mistaken for the temperature right now. Without a forecast, the admin's typed "now".
 * The two figures are isolated left-to-right so an Arabic line cannot swap them.
 */
export function weatherLabel(c: CityWeather): string | null {
  const today = c.days[0];
  if (today) return `\u2066${today.max}°/${today.min}°\u2069`;
  return c.current?.temp ? `${c.current.temp}°` : null;
}

/** The number shown for a city in the ticker: the admin's "now" temperature, else today's forecast high. */
export function headlineTemp(c: CityWeather): string | null {
  if (c.current?.temp) return c.current.temp;
  return c.days[0] ? String(c.days[0].max) : null;
}

// ---- prayer times ----

export const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];
export type PrayerTimes = Record<PrayerKey, string>;

const ALADHAN_KEY: Record<PrayerKey, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

/** `data.timings` of an Aladhan answer as `HH:mm` strings (a trailing " (EEST)" is dropped); null unless all six are there. */
export function parsePrayerTimes(raw: unknown): PrayerTimes | null {
  const timings = (raw as { data?: { timings?: Record<string, unknown> } } | null)?.data?.timings;
  if (!timings) return null;
  const out = {} as PrayerTimes;
  for (const key of PRAYER_KEYS) {
    const v = timings[ALADHAN_KEY[key]];
    const m = typeof v === 'string' ? /(\d{1,2}):(\d{2})/.exec(v) : null;
    if (!m) return null;
    out[key] = `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  return out;
}

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Today's date (`YYYY-MM-DD`) and the minute of the day in Palestine, whatever the visitor's own timezone is. */
export function palestineNow(now: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hebron',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** `YYYY-MM-DD` → `DD-MM-YYYY` (Aladhan's path format). */
export const aladhanDate = (isoDate: string) => isoDate.split('-').reverse().join('-');

/**
 * The next of the five prayers (sunrise is a time of day, not a prayer). After Isha it is tomorrow's Fajr, so `tomorrow`
 * is set and the time shown is today's Fajr (close enough for a highlight).
 */
export function nextPrayer(times: PrayerTimes, minutes: number): { key: PrayerKey; tomorrow: boolean } {
  const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
  const next = prayers.find((k) => toMinutes(times[k]) > minutes);
  return next ? { key: next, tomorrow: false } : { key: 'fajr', tomorrow: true };
}

// ---- calendar ----

/** Hijri date in the UI language (Umm al-Qura, like the legacy Aladhan `gToH` default) — computed on the device, no request. */
export function formatHijri(now: Date, lang: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    calendar: 'islamic-umalqura',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
}

export function formatGregorianLong(now: Date, lang: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
}

/** `YYYY-MM-DD` as a date at local noon (no timezone shift when formatted). */
export function isoToDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DAY_MS = 86_400_000;

export interface EventRow {
  item: WidgetItem;
  /** Whole days from today (0 = today, negative = past); null when the row has no valid date. */
  days: number | null;
}

/** Events from today on (soonest first), the past ones (most recent first) and the rows without a usable date. */
export function splitEvents(
  items: readonly WidgetItem[],
  todayIso: string,
): { upcoming: EventRow[]; past: EventRow[]; undated: EventRow[] } {
  const today = isoToDate(todayIso);
  const upcoming: EventRow[] = [];
  const past: EventRow[] = [];
  const undated: EventRow[] = [];
  for (const item of items) {
    const d = item.date ? isoToDate(item.date) : null;
    if (!d || !today) {
      undated.push({ item, days: null });
      continue;
    }
    const days = Math.round((d.getTime() - today.getTime()) / DAY_MS);
    (days >= 0 ? upcoming : past).push({ item, days });
  }
  upcoming.sort((a, b) => a.days! - b.days!);
  past.sort((a, b) => b.days! - a.days!);
  return { upcoming, past, undated };
}

// ---- "last updated" ----

/** ISO string of a query's last successful fetch (for cards whose data is not stamped by the server). */
export const isoFromMs = (ms: number): string | null => (ms > 0 ? new Date(ms).toISOString() : null);

// ---- ticker ----

export interface TickerItem {
  key: string;
  /** The portal card the item opens. */
  card: CardId;
  /** Text from the admin (already the right language) or a translated name, never markup. */
  label: string;
  value?: string;
  unit?: string;
}

export interface TickerInput {
  data: WidgetsData | undefined;
  weather: CityWeather[];
  prayer: PrayerTimes | null;
  minutes: number;
  /** Translated name of a prayer / city / card. */
  name: (kind: 'prayer' | 'city' | 'card', id: string) => string;
  hijri: string;
  /** Translated "next prayer" prefix, e.g. "Next: Asr". */
  nextLabel: (prayerName: string) => string;
}

const PER_GROUP: Record<PriceCardId, number> = {
  currency: 4,
  gold: 3,
  fuel: 3,
  'transport-inter': 2,
  'transport-intra': 2,
};

/** What scrolls in the bar: the first rows of every group with data, the next prayer, the hijri date and the two status lists. */
export function buildTickerItems(input: TickerInput): TickerItem[] {
  const out: TickerItem[] = [];
  const priceRows = (card: PriceCardId) => {
    for (const r of groupItems(input.data, PRICE_GROUP[card]).slice(0, PER_GROUP[card]))
      if (r.label && r.value)
        out.push({
          key: `${card}:${r.id ?? r.label}`,
          card,
          label: card === 'currency' ? r.code || r.label : r.label,
          value: displayValue(r.value),
          unit: r.unit,
        });
  };
  priceRows('currency');
  priceRows('gold');
  for (const c of input.weather.slice(0, 3)) {
    const temp = weatherLabel(c);
    if (temp)
      out.push({
        key: `weather:${c.id}`,
        card: 'weather',
        label: isKnownCity(c.id) ? input.name('city', c.id) : (c.label ?? c.id),
        value: temp,
      });
  }
  priceRows('fuel');
  priceRows('transport-inter');
  priceRows('transport-intra');
  if (input.prayer) {
    const next = nextPrayer(input.prayer, input.minutes);
    out.push({
      key: 'prayer',
      card: 'prayer',
      label: input.nextLabel(input.name('prayer', next.key)),
      value: input.prayer[next.key],
    });
  }
  out.push({ key: 'calendar', card: 'calendar', label: input.name('card', 'calendar'), value: input.hijri });
  out.push({ key: 'road-status', card: 'road-status', label: input.name('card', 'road-status') });
  out.push({ key: 'fuel-status', card: 'fuel-status', label: input.name('card', 'fuel-status') });
  return out;
}

// ---- live market prices ----

/** Translated names of the live rows (the admin's rows carry their own text; these carry ours). */
export interface MarketLabels {
  usd: string;
  eur: string;
  jod: string;
  gold24: string;
  gold21: string;
  gold18: string;
  goldOunce: string;
  silver: string;
  perGram: string;
  perOunce: string;
}

/**
 * The currency and gold groups with the world market's numbers instead of what an admin once typed (those were the only
 * hand-kept prices that the outside world moves every day). A part whose source is down keeps the admin's rows; the group's
 * "last update" becomes the moment our server fetched. Fuel, fares and events stay the admin's: no public source has them.
 */
export function applyMarket(data: WidgetsData | undefined, market: MarketRates | undefined, l: MarketLabels): WidgetsData | undefined {
  if (!data || !market) return data;
  const groups = { ...data.groups };
  const at = market.updatedAt;
  const fixed = (n: number, digits: number) => n.toFixed(digits);
  if (market.rates) {
    const { USD_ILS, EUR_ILS, JOD_ILS } = market.rates;
    groups.currency = {
      updated_at: at,
      items: [
        { id: 'live-usd', code: 'USD/ILS', label: l.usd, value: fixed(USD_ILS, 2) },
        { id: 'live-eur', code: 'EUR/ILS', label: l.eur, value: fixed(EUR_ILS, 2) },
        { id: 'live-jod', code: 'JOD/ILS', label: l.jod, value: fixed(JOD_ILS, 2) },
      ],
    };
  }
  if (market.gold) {
    const g = market.gold;
    const rows: WidgetItem[] = [];
    if (g.ilsPerGram24 && g.ilsPerGram21 && g.ilsPerGram18)
      rows.push(
        { id: 'live-gold-24', label: l.gold24, value: fixed(g.ilsPerGram24, 0), unit: l.perGram },
        { id: 'live-gold-21', label: l.gold21, value: fixed(g.ilsPerGram21, 0), unit: l.perGram },
        { id: 'live-gold-18', label: l.gold18, value: fixed(g.ilsPerGram18, 0), unit: l.perGram },
      );
    rows.push({ id: 'live-gold-ounce', label: l.goldOunce, value: fixed(g.usdPerOunce, 0), unit: l.perOunce });
    if (market.silver) rows.push({ id: 'live-silver', label: l.silver, value: fixed(market.silver.usdPerOunce, 2), unit: l.perOunce });
    groups.gold = { updated_at: at, items: rows };
  }
  return { ...data, groups };
}
