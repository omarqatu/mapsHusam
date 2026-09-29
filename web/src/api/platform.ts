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

export const platformApi = {
  stats: () => api.get<{ success: boolean; data?: PlatformStats }>('/api/platform-stats'),
};

export const platformKeys = { stats: ['platform-stats'] as const };

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
