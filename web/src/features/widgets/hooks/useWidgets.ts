import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fuelKeys, readFuelPrices, useFuelPrices } from '@/api/fuel';
import { marketKeys, readMarketRates, useMarketRates } from '@/api/market';
import { externalApi } from '@/api/external';
import { WIDGETS_REFRESH_MS, widgetsApi, widgetsKeys, type WidgetsData } from '@/api/widgets';
import {
  applyFuel,
  applyMarket,
  aladhanDate,
  CITIES,
  FORECAST_DAYS,
  groupItems,
  mergeWeather,
  palestineNow,
  parseForecast,
  parsePrayerTimes,
  type CityWeather,
} from '../model';

const HOUR = 3_600_000;

export const externalKeys = {
  all: ['widgets-external'] as const,
  weather: ['widgets-external', 'weather'] as const,
  prayer: (date: string) => ['widgets-external', 'prayer', date] as const,
};

/**
 * The seven manual groups + the road / fuel stamps. Polled every minute while the tab is visible (TanStack pauses
 * intervals in the background) and refetched on return when stale — legacy `createVisibilityAwareInterval`.
 */
export function useWidgetsData() {
  const { t } = useTranslation();
  const market = useMarketRates().data;
  const fuel = useFuelPrices().data;
  // Currency, gold and fuel come from live sources (see applyMarket / applyFuel); the rest is what the admin saved.
  const select = useCallback(
    (d: WidgetsData) => {
      const labels = {
        usd: t('widgets.live.usd'),
        eur: t('widgets.live.eur'),
        jod: t('widgets.live.jod'),
        gold24: t('widgets.live.gold24'),
        gold21: t('widgets.live.gold21'),
        gold18: t('widgets.live.gold18'),
        goldOunce: t('widgets.live.goldOunce'),
        silver: t('widgets.live.silver'),
        perGram: t('widgets.live.perGram'),
        perOunce: t('widgets.live.perOunce'),
        perLiter: t('widgets.live.perLiter'),
        perCylinder: t('widgets.live.perCylinder'),
        fuel: {
          'fuel-95': t('widgets.live.fuel95'),
          'fuel-98': t('widgets.live.fuel98'),
          'fuel-diesel': t('widgets.live.fuelDiesel'),
          kas: t('widgets.live.kas'),
          'fuel-gas-small5': t('widgets.live.gas5'),
          'fuel-gas-cylinder': t('widgets.live.gas12'),
          'fuel-gas-large': t('widgets.live.gas48'),
        },
      };
      return applyFuel(applyMarket(d, market, labels), fuel, labels) as WidgetsData;
    },
    [market, fuel, t],
  );
  return useQuery({
    queryKey: widgetsKeys.data,
    queryFn: ({ signal }) => widgetsApi.data(signal),
    select,
    staleTime: WIDGETS_REFRESH_MS / 2,
    refetchInterval: WIDGETS_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}

/** Three-day forecast of the eleven cities from Open-Meteo, every 30 minutes (legacy interval). */
export function useForecast(enabled = true) {
  return useQuery({
    queryKey: externalKeys.weather,
    queryFn: async ({ signal }) => parseForecast(await externalApi.forecast(CITIES, FORECAST_DAYS, signal)),
    enabled,
    staleTime: 15 * 60_000,
    refetchInterval: 30 * 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Cities to show: the admin's rows merged with the forecast. `forecastFailed` = the forecast (not the admin data) is missing. */
export function useWeather(enabled = true) {
  const data = useWidgetsData();
  const forecast = useForecast(enabled);
  const admin = useMemo(() => groupItems(data.data, 'weather'), [data.data]);
  const cities: CityWeather[] = useMemo(() => mergeWeather(admin, forecast.data), [admin, forecast.data]);
  return { cities, data, forecast };
}

/** Today's six prayer times for Jerusalem (Aladhan); the day comes from Palestine's clock, refetched hourly. */
export function usePrayerTimes(now: Date, enabled = true) {
  const { date } = palestineNow(now);
  return useQuery({
    queryKey: externalKeys.prayer(date),
    queryFn: async ({ signal }) => {
      const times = parsePrayerTimes(await externalApi.prayerTimes(aladhanDate(date), signal));
      if (!times) throw new Error('prayer');
      return times;
    },
    enabled,
    staleTime: HOUR / 2,
    refetchInterval: HOUR,
    refetchOnWindowFocus: true,
  });
}

/** Re-renders every `ms` (default one minute) so "next prayer" and "today" stay right on a page left open. */
export function useNow(ms = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const REFRESH_ROOTS = [widgetsKeys.data, ['status-rows'], externalKeys.all] as const;
/** The live prices are read from their sources by the server; "refresh all" asks it to do so now, so they are fetched, not just invalidated. */
const LIVE_PRICE_ROOTS = [marketKeys.rates, fuelKeys.prices] as const;

/** "Refresh all" (legacy button): refetch every widget query that is on screen; `busy` while any of them loads. */
export function useRefreshAll() {
  const qc = useQueryClient();
  const busy =
    useIsFetching({
      predicate: (q) =>
        [...REFRESH_ROOTS, ...LIVE_PRICE_ROOTS].some((root) =>
          root.every((part, i) => q.queryKey[i] === part),
        ),
    }) > 0;
  const refresh = () =>
    void Promise.allSettled([
      ...REFRESH_ROOTS.map((queryKey) => qc.invalidateQueries({ queryKey })),
      qc.fetchQuery({ queryKey: marketKeys.rates, queryFn: () => readMarketRates(true), staleTime: 0 }),
      qc.fetchQuery({ queryKey: fuelKeys.prices, queryFn: () => readFuelPrices(true), staleTime: 0 }),
    ]);
  return { refresh, busy };
}
