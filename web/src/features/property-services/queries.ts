import { useQueries, useQuery } from '@tanstack/react-query';
import { featuredApi } from '@/api/featured';
import { mapEventsApi, type MapEventType } from '@/api/mapEvents';
import { platformContentApi, platformContentKeys } from '@/api/platformContent';
import { geoQueryOptions } from '@/api/queryClient';
import { searchApi } from '@/api/search';
import { useAuthStore } from '@/store/authStore';
import { toResults, type SearchResult } from '../map/search/results';
import { targetFromKey } from '../map/targets';
import {
  DEFAULT_PROPERTY_SERVICES,
  PROPERTY_SERVICES_KEY,
  parsePropertyServices,
  type PropertyServicesConfig,
} from './model';
import type { RatingSummary } from './rank';

const FIVE_MINUTES = 5 * 60_000;

/** The admin's list of types per property kind; `null` while loading, the built-in list if the request fails. */
export function usePropertyServicesConfig(): PropertyServicesConfig | null {
  const q = useQuery({
    queryKey: platformContentKeys.item(PROPERTY_SERVICES_KEY),
    queryFn: async () => parsePropertyServices((await platformContentApi.get(PROPERTY_SERVICES_KEY)).item?.content_value),
    staleTime: FIVE_MINUTES,
  });
  return q.isError ? DEFAULT_PROPERTY_SERVICES : (q.data ?? null);
}

export const propertyServicesKeys = {
  providers: (type: string) => ['property-services', 'providers', type] as const,
  ratings: (type: string) => ['property-services', 'ratings', type] as const,
};

export interface TypeProviders {
  type: string;
  /** null while loading. */
  providers: SearchResult[] | null;
}

/**
 * Every provider of each type (a type is a small list: surveyors, valuers, lawyers — tens, not thousands), fetched when
 * the property card opens so the card can say how many there are, and hide a type nobody offers yet.
 */
export function useTypeProviders(types: readonly string[]): TypeProviders[] {
  const results = useQueries({
    queries: types.map((type) => ({
      queryKey: propertyServicesKeys.providers(type),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        searchApi.search({ layer: type, workspace: 'services' }, signal).then((fc) => toResults(fc, targetFromKey(type))),
      staleTime: FIVE_MINUTES,
      ...geoQueryOptions,
    })),
  });
  // A type that failed to load counts as empty: one broken type must not take the others down.
  return types.map((type, i) => ({
    type,
    providers: results[i].isError ? [] : (results[i].data ?? null),
  }));
}

const NO_RATINGS: ReadonlyMap<string, RatingSummary> = new Map();

/** Real ratings of one type's providers, keyed by feature id. Optional: without them the ranking just has no rating step. */
export function useTypeRatings(type: string | null): ReadonlyMap<string, RatingSummary> {
  const { data } = useQuery({
    queryKey: propertyServicesKeys.ratings(type ?? ''),
    queryFn: async ({ signal }) => {
      const { items } = await featuredApi.ratingsSummary(type!, signal);
      return new Map<string, RatingSummary>(
        (items ?? []).map((i) => [String(i.feature_id), { avg: Number(i.avg_rating), count: Number(i.total_ratings) }]),
      );
    },
    enabled: !!type,
    staleTime: FIVE_MINUTES,
    retry: false,
  });
  return data ?? NO_RATINGS;
}

/** Measurement (own source, so it is neither a visit nor part of the request quota). Signed-in people only; never blocks, never shows an error. */
export function logPropertyServices(event: Extract<MapEventType, `property_services_${string}`>, service: string) {
  if (!useAuthStore.getState().user) return;
  void mapEventsApi
    .logMapEvent({ event_type: event, provider: null, service, source: 'property_services' })
    .catch(() => undefined);
}
