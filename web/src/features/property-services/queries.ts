import { useQueries, useQuery } from '@tanstack/react-query';
import { featuredApi } from '@/api/featured';
import { platformContentApi, platformContentKeys } from '@/api/platformContent';
import { geoQueryOptions } from '@/api/queryClient';
import { searchApi } from '@/api/search';
import {
  propertyServicesApi,
  type PropertyServicesEvent,
} from '@/api/propertyServices';
import type { Coordinate } from '../map/config';
import { distanceToResult } from '../map/search/nearby';
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

// --- finding the providers around a property -------------------------------------------------------------------------

/** The search starts this close to the property and widens one step at a time, only while it finds too few. */
export const RADII_KM = [10, 25, 50] as const;
/** Fewer than this many within a radius = widen (or, past the last step, fall back to the governorate). */
export const MIN_RESULTS = 3;

export interface NearbyProviders {
  providers: SearchResult[];
  /** The widest radius that was searched, in km. */
  radiusKm: number;
  /** The radius found too few, so the governorate's providers were added (any distance). */
  viaGovernorate: boolean;
}

/**
 * Providers of one type around a property: a box around its point (the server filters by it, so a type with hundreds of
 * rows never travels whole), cut to a real circle here; widened step by step while there are fewer than MIN_RESULTS. The
 * governorate is only the last resort — it adds its providers when even the widest radius found too few.
 */
export async function findProviders(
  type: string,
  origin: Coordinate,
  gov: string,
  signal?: AbortSignal,
): Promise<NearbyProviders> {
  const target = targetFromKey(type);
  let found: SearchResult[] = [];
  let radiusKm: number = RADII_KM[0];
  for (const km of RADII_KM) {
    radiusKm = km;
    const m = km * 1000;
    const fc = await searchApi.search(
      {
        layer: type,
        workspace: 'services',
        bbox: [origin[0] - m, origin[1] - m, origin[0] + m, origin[1] + m].map(Math.round),
      },
      signal,
    );
    found = toResults(fc, target).filter((r) => distanceToResult(r, origin) <= m);
    if (found.length >= MIN_RESULTS) return { providers: found, radiusKm, viaGovernorate: false };
  }
  if (!gov) return { providers: found, radiusKm, viaGovernorate: false };
  const fc = await searchApi.search(
    { layer: type, workspace: 'services', conditions: [{ field: 'gov_a', operator: '=', value: gov }] },
    signal,
  );
  const have = new Set(found.map((r) => r.key));
  const added = toResults(fc, target).filter((r) => !have.has(r.key));
  return { providers: [...found, ...added], radiusKm, viaGovernorate: added.length > 0 };
}

export const propertyServicesKeys = {
  providers: (type: string, origin: Coordinate, gov: string) =>
    ['property-services', 'providers', type, Math.round(origin[0]), Math.round(origin[1]), gov] as const,
  ratings: (type: string) => ['property-services', 'ratings', type] as const,
};

export interface TypeProviders {
  type: string;
  /** null while loading; a type that failed to load counts as empty. */
  nearby: NearbyProviders | null;
}

/**
 * The providers around a property, for each type, fetched when the property card opens so the card can say how many
 * there are, and hide a type nobody offers. One broken type must not take the others down.
 */
export function useTypeProviders(types: readonly string[], origin: Coordinate, gov: string): TypeProviders[] {
  const results = useQueries({
    queries: types.map((type) => ({
      queryKey: propertyServicesKeys.providers(type, origin, gov),
      queryFn: ({ signal }: { signal: AbortSignal }) => findProviders(type, origin, gov, signal),
      staleTime: FIVE_MINUTES,
      ...geoQueryOptions,
    })),
  });
  return types.map((type, i) => ({
    type,
    nearby: results[i].isError ? { providers: [], radiusKm: RADII_KM[0], viaGovernorate: false } : (results[i].data ?? null),
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

// --- measurement ------------------------------------------------------------------------------------------------------

/** One id per browser tab for visitors (sessionStorage), so "people" can be counted without an account. */
function visitorId(): string | undefined {
  try {
    let id = sessionStorage.getItem('psm-visitor');
    if (!id) {
      id = `guest-${Math.random().toString(36).slice(2, 12)}`;
      sessionStorage.setItem('psm-visitor', id);
    }
    return id;
  } catch {
    return undefined; // blocked storage: the server files the event under plain "guest"
  }
}

/** Fire and forget: measurement never blocks and never shows an error. */
export function trackPropertyServices(event: Omit<PropertyServicesEvent, 'visitor'>) {
  void propertyServicesApi.track({ ...event, visitor: visitorId() }).catch(() => undefined);
}

/** Events that repeat while a card is open (view, looking at a type) are sent once per tab and property. */
const sentOnce = new Set<string>();
export function trackPropertyServicesOnce(event: Omit<PropertyServicesEvent, 'visitor'>) {
  const key = [event.action, event.property_layer, event.property_id, event.service_type ?? ''].join('|');
  if (sentOnce.has(key)) return;
  sentOnce.add(key);
  trackPropertyServices(event);
}
