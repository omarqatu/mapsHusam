import { useMemo, useState, type ReactNode } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  MapPin,
  RefreshCw,
  Sun,
  Wind,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import EmptyState from '@/components/ui/EmptyState';
import SearchInput from '@/components/ui/SearchInput';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { matchesQuery } from '@/features/map/extras/status';
import UpdatedAgo from '@/features/map/extras/UpdatedAgo';
import { intlLocale } from '@/lib/format';
import {
  isoFromMs,
  isKnownCity,
  isoToDate,
  type CityWeather,
  type ForecastDay,
  type WeatherKind,
} from '../model';
import { useWeather } from '../hooks/useWidgets';
import GroupCard from './GroupCard';

const ICON: Record<WeatherKind, { Icon: typeof Sun; color: string }> = {
  clear: { Icon: Sun, color: 'text-amber-500' },
  partly: { Icon: CloudSun, color: 'text-amber-500' },
  cloudy: { Icon: Cloud, color: 'text-slate-500' },
  fog: { Icon: CloudFog, color: 'text-slate-500' },
  rain: { Icon: CloudDrizzle, color: 'text-sky-600' },
  showers: { Icon: CloudRain, color: 'text-sky-700' },
  snow: { Icon: CloudSnow, color: 'text-cyan-600' },
  storm: { Icon: CloudLightning, color: 'text-violet-600' },
};

export function WeatherIcon({ kind, className = 'h-7 w-7' }: { kind: WeatherKind; className?: string }) {
  const { Icon, color } = ICON[kind];
  return <Icon className={`${className} ${color}`} aria-hidden />;
}

/** Today / tomorrow, then the weekday name (legacy: today / tomorrow / day after). */
function dayLabel(day: ForecastDay, index: number, lang: string, t: (k: string) => string) {
  if (index === 0) return t('widgets.weather.today');
  if (index === 1) return t('widgets.weather.tomorrow');
  const d = isoToDate(day.date);
  return d ? new Intl.DateTimeFormat(intlLocale(lang), { weekday: 'long' }).format(d) : day.date;
}

function CityTile({ city }: { city: CityWeather }) {
  const { t, i18n } = useTranslation();
  const name = isKnownCity(city.id) ? t(`widgets.cities.${city.id}`) : (city.label ?? city.id);
  const today = city.days[0];
  const condition = city.current?.condition ?? (today ? t(`widgets.weather.kind.${today.kind}`) : undefined);
  const temp = city.current?.temp ?? (today ? String(today.max) : undefined);

  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-base font-bold text-slate-800" dir="auto">
            <MapPin className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            {name}
          </div>
          {condition && (
            <div className="mt-0.5 text-sm text-slate-700" dir="auto">
              {condition}
            </div>
          )}
        </div>
        {temp && (
          <div className="flex shrink-0 items-center gap-2">
            {today && <WeatherIcon kind={today.kind} className="h-8 w-8" />}
            <span className="text-3xl font-black tabular-nums text-slate-900" dir="ltr">
              {temp}°
            </span>
          </div>
        )}
      </div>

      {(city.current?.humidity || city.current?.wind) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
          {city.current.humidity && (
            <span className="inline-flex items-center gap-1.5">
              <Droplets className="h-4 w-4 text-sky-600" aria-hidden />
              {t('widgets.weather.humidity')} <b dir="ltr">{city.current.humidity}%</b>
            </span>
          )}
          {city.current.wind && (
            <span className="inline-flex items-center gap-1.5">
              <Wind className="h-4 w-4 text-slate-600" aria-hidden />
              {t('widgets.weather.wind')} <b dir="ltr">{city.current.wind}</b> {t('widgets.weather.windUnit')}
            </span>
          )}
        </div>
      )}

      {city.days.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {city.days.map((day, i) => (
            <li key={day.date} className="rounded-lg bg-white px-1 py-2 text-center ring-1 ring-slate-200">
              <div className="truncate px-1 text-sm font-semibold text-slate-700">
                {dayLabel(day, i, i18n.language, t)}
              </div>
              <div className="my-1 flex justify-center">
                <WeatherIcon kind={day.kind} />
              </div>
              <div className="text-base font-bold tabular-nums text-slate-900" dir="ltr">
                <span title={t('widgets.weather.high')}>{day.max}°</span>
                <span className="mx-1 text-slate-500" aria-hidden>
                  /
                </span>
                <span className="font-semibold text-slate-600" title={t('widgets.weather.low')}>
                  {day.min}°
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const SEARCH_MIN = 8;

/** Current conditions the admin typed plus the three-day Open-Meteo forecast, one tile per city. */
export default function WeatherCard({
  id,
  title,
  className,
}: {
  id: string;
  title: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { cities, data, forecast } = useWeather();
  const [query, setQuery] = useState('');
  const shown = useMemo(
    () =>
      cities.filter((c) =>
        matchesQuery(
          [isKnownCity(c.id) ? t(`widgets.cities.${c.id}`) : (c.label ?? c.id), c.current?.condition]
            .filter(Boolean)
            .join(' '),
          query,
        ),
      ),
    [cities, query, t],
  );

  // The server stamp belongs to the admin's rows; a forecast-only card is "updated" when the forecast arrived.
  const adminStamp = data.data?.groups?.weather?.updated_at ?? null;
  const stamp = adminStamp ?? isoFromMs(forecast.dataUpdatedAt);
  const stampNow = adminStamp ? data.dataUpdatedAt : forecast.dataUpdatedAt;

  let body: ReactNode;
  if (cities.length === 0 && (forecast.isPending || data.isPending))
    body = <CenteredSpinner minHeight="10rem" />;
  else if (cities.length === 0)
    body = (
      <div className="space-y-3">
        <AlertMessage type="error" message={t('widgets.weather.failed')} />
        <EmptyState title={t('widgets.empty')} />
      </div>
    );
  else
    body = (
      <>
        {forecast.isError && (
          <div className="flex flex-wrap items-center gap-2">
            <AlertMessage type="warning" message={t('widgets.weather.forecastFailed')} className="flex-1" />
            <button
              type="button"
              onClick={() => void forecast.refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" aria-hidden /> {t('common.retry')}
            </button>
          </div>
        )}
        {cities.length > SEARCH_MIN && (
          <SearchInput
            value={query}
            onChange={setQuery}
            debounceMs={150}
            placeholder={t('widgets.search.city')}
          />
        )}
        {shown.length === 0 ? (
          <p className="py-6 text-center text-base text-slate-600">{t('widgets.noMatch')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((c) => (
              <CityTile key={c.id} city={c} />
            ))}
          </ul>
        )}
        <p className="text-sm text-slate-600">{t('widgets.weather.source')}</p>
      </>
    );

  return (
    <GroupCard
      id={id}
      title={title}
      icon={<CloudSun className="h-5 w-5" aria-hidden />}
      chip="bg-sky-100 text-sky-800"
      subtitle={<UpdatedAgo at={stamp} now={stampNow} />}
      className={className}
    >
      {body}
    </GroupCard>
  );
}
