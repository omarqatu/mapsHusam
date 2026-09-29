import { useQuery } from '@tanstack/react-query';
import { featuredApi } from '@/api/featured';
import { geoQueryOptions } from '@/api/queryClient';
import { searchApi, type SearchCondition } from '@/api/search';
import { toResults, type SearchResult } from '../search/results';
import { ALL_TARGETS, targetFromKey, targetToApi, type MapTarget } from '../targets';
import type { FeaturedEntry } from './featured';

// Query hooks of the featured portal: everything is public GET/POST data, shaped into map results (`SearchResult`).

const REAL_ESTATE = ALL_TARGETS.filter((t) => t.kind === 'realEstate');

/** Runs the tasks side by side; a failed one contributes nothing (legacy), but if every one fails the query fails. */
async function settle(tasks: Promise<SearchResult[]>[]): Promise<SearchResult[]> {
  const done = await Promise.allSettled(tasks);
  const ok = done.filter((d): d is PromiseFulfilledResult<SearchResult[]> => d.status === 'fulfilled');
  if (ok.length === 0) {
    const first = done[0];
    throw first?.status === 'rejected' ? first.reason : new Error('featured');
  }
  return ok.flatMap((d) => d.value);
}

/** Services (all types at once, tagged by their own discriminator) and each real-estate layer. */
function fetchAcross(
  conditions: SearchCondition[],
  signal?: AbortSignal,
): Promise<SearchResult[]>[] {
  const service = searchApi
    .search({ layer: 'service_all', workspace: 'services', conditions }, signal)
    .then((fc) => toResults(fc, null));
  const realEstate = REAL_ESTATE.map((target) => {
    const api = targetToApi(target);
    return searchApi.search({ ...api, conditions }, signal).then((fc) => toResults(fc, target));
  });
  return [service, ...realEstate];
}

export const extrasKeys = {
  rating: (value: string) => ['featured', 'rating', value] as const,
  topRated: ['featured', 'top-rated'] as const,
  candidates: ['featured', 'nearby-candidates'] as const,
};

/** Every open service and property whose `rating` column equals `value` ("10" featured, "9.9" recommended). */
export function useRatedFeatures(value: string) {
  return useQuery({
    queryKey: extrasKeys.rating(value),
    queryFn: ({ signal }) => settle(fetchAcross([{ field: 'rating', operator: '=', value }], signal)),
    ...geoQueryOptions,
  });
}

const TOP_RATED_LIMIT = 15;

/** Providers ranked by real customer ratings, joined with their feature rows (legacy fetchUserRatedServices). */
export function useTopRatedFeatures() {
  return useQuery({
    queryKey: extrasKeys.topRated,
    queryFn: async ({ signal }): Promise<FeaturedEntry[]> => {
      const { items } = await featuredApi.topRated(TOP_RATED_LIMIT);
      // Only service types the map knows; real-estate ratings don't exist in service_ratings.
      const known = (items ?? []).flatMap((item) => {
        const target = targetFromKey(item.service_layer);
        return target?.kind === 'service' && item.feature_id !== null && item.feature_id !== undefined
          ? [{ item, target }]
          : [];
      });
      const byLayer = new Map<string, { target: MapTarget; ids: (string | number)[] }>();
      for (const { item, target } of known) {
        const layer = String(item.service_layer);
        const group = byLayer.get(layer) ?? { target, ids: [] };
        group.ids.push(item.feature_id);
        byLayer.set(layer, group);
      }
      const found = new Map<string, SearchResult>();
      await Promise.all(
        [...byLayer.entries()].map(async ([layer, { target, ids }]) => {
          try {
            const fc = await searchApi.batch({ layer, workspace: 'services', ids }, signal);
            for (const r of toResults(fc, target)) if (r.id) found.set(`${layer}:${r.id}`, r);
          } catch {
            /* legacy: a layer that fails to load just drops out */
          }
        }),
      );
      return known.flatMap(({ item }) => {
        const r = found.get(`${item.service_layer}:${item.feature_id}`);
        return r ? [{ r, ratings: { avg: Number(item.avg_rating), total: Number(item.total_ratings) } }] : [];
      });
    },
    ...geoQueryOptions,
  });
}

/** Whole service_all + property layers, fetched once the visitor shares a location ("near me"). */
export function useNearbyCandidates(enabled: boolean) {
  return useQuery({
    queryKey: extrasKeys.candidates,
    queryFn: ({ signal }) => settle(fetchAcross([], signal)),
    enabled,
    ...geoQueryOptions,
  });
}
