import { useQuery } from '@tanstack/react-query';
import { geoQueryOptions } from '@/api/queryClient';
import { searchApi } from '@/api/search';
import { toResults, type SearchResult } from '../map/search/results';
import { targetFromKey } from '../map/targets';

/** Every listing of one service type (surveyors, valuers: tens of rows) — the pool an owner picks from. */
export function useProvidersOfType(layer: string, enabled: boolean) {
  return useQuery({
    queryKey: ['property-relations', 'providers', layer],
    queryFn: async ({ signal }): Promise<SearchResult[]> =>
      toResults(await searchApi.search({ layer, workspace: 'services' }, signal), targetFromKey(layer)),
    enabled,
    staleTime: 5 * 60_000,
    ...geoQueryOptions,
  });
}
