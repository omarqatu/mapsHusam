import { useQuery } from '@tanstack/react-query';
import { api } from './client';

// GET /api/platform-stats (server.js, public, cached 60 s server-side). Every field below is what the handler returns.

export interface PlatformStats {
  usersTotal: number;
  usersAdmin: number;
  usersUser: number;
  usersProvider: number;
  /** Map visits + quick-search visits. */
  viewsTotal: number;
  viewsMap: number;
  viewsQuickSearch: number;
  /** Number of service types (layers) on the map. */
  servicesCount: number;
  /** Every feature on the map: all real-estate rows + all service rows (the "providers" figure of legacy). */
  featuresCount: number;
}

/** GET /api/category-counts (public, cached 60 s): visible listings per type, keyed by `ApartRent` / `ApartSale` / `LandSale` or a service discriminator. */
export interface CategoryCounts {
  counts: Record<string, number>;
}

export const platformApi = {
  stats: () => api.get<{ success: boolean; data?: PlatformStats }>('/api/platform-stats'),
  categoryCounts: () => api.get<{ success: boolean; data?: CategoryCounts }>('/api/category-counts'),
};

export const platformKeys = { stats: ['platform-stats'] as const, categoryCounts: ['category-counts'] as const };

/** Platform counters. Legacy retried 3x with a growing delay; the server caches for a minute, so a minute is fresh enough. */
export function usePlatformStats(enabled = true) {
  return useQuery({
    queryKey: platformKeys.stats,
    queryFn: async () => {
      const res = await platformApi.stats();
      if (!res.success || !res.data) throw new Error('platform-stats');
      return res.data;
    },
    enabled,
    staleTime: 60_000,
    retry: 3,
    retryDelay: (attempt) => 1000 * (attempt + 1),
  });
}

/** Listings per type for the section cards; a failure just leaves the cards without numbers. */
export function useCategoryCounts() {
  return useQuery({
    queryKey: platformKeys.categoryCounts,
    queryFn: async () => {
      const res = await platformApi.categoryCounts();
      if (!res.success || !res.data) throw new Error('category-counts');
      return res.data.counts;
    },
    staleTime: 60_000,
  });
}
