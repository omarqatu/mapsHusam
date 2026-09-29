// Third-party reads the widgets need (legacy called both straight from the browser): the Open-Meteo forecast and the
// Aladhan prayer times. Kept apart from client.ts on purpose — like geoserver.ts, the app JWT must never be sent to
// another origin, so these requests carry no credentials, no cookies and no referrer. Responses are returned as
// `unknown`; `features/widgets/model.ts` validates them.

export interface CityPoint {
  id: string;
  lat: number;
  lon: number;
}

export class ExternalApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ExternalApiError';
    this.status = status;
  }
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new ExternalApiError(`HTTP ${res.status}`, res.status);
  return res.json();
}

/** Palestinian Aladhan settings of the legacy config (`WIDGETS_API_CONFIG.prayer`): Jerusalem, method 23 + tune. */
const PRAYER_BASE = 'https://api.aladhan.com/v1/timingsByCity';
const PRAYER_PARAMS = {
  city: 'Jerusalem',
  country: 'Palestine',
  method: '23',
  tune: '0,7,14,28,42,38,0,47,0',
};

export const externalApi = {
  /** One request for every city (Open-Meteo answers an array in the same order); `days` = forecast length. */
  forecast: (cities: readonly CityPoint[], days: number, signal?: AbortSignal) => {
    const qs = new URLSearchParams({
      latitude: cities.map((c) => c.lat).join(','),
      longitude: cities.map((c) => c.lon).join(','),
      daily: 'temperature_2m_max,temperature_2m_min,weathercode',
      timezone: 'Asia/Hebron',
      forecast_days: String(days),
    });
    return getJson(`https://api.open-meteo.com/v1/forecast?${qs}`, signal);
  },
  /** `date` = `DD-MM-YYYY`. */
  prayerTimes: (date: string, signal?: AbortSignal) =>
    getJson(`${PRAYER_BASE}/${date}?${new URLSearchParams(PRAYER_PARAMS)}`, signal),
};
