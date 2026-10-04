import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { geoQueryOptions } from '@/api/queryClient';
import { searchApi, type SearchCondition } from '@/api/search';
import { passesSearchQuota } from '@/lib/searchQuota';
import { fetchGlobalHits, rankHits, type GlobalHit } from '../map/search/globalSearch';
import { cascadeFilters } from '../map/search/model';
import { toResults, type SearchResult } from '../map/search/results';
import { targetKey, targetLabelKey, targetToApi, type MapTarget } from '../map/targets';

/** The server returns at most this many rows per search (`LIMIT 2000` in server.js). */
export const SERVER_ROW_CAP = 2000;
/** The keyword box shows the best this many hits (legacy). */
export const KEYWORD_LIMIT = 50;
export const KEYWORD_MIN_CHARS = 2;

export const searchPageKeys = {
  category: (target: MapTarget, conditions: SearchCondition[]) =>
    ['search-page', 'category', targetKey(target), conditions] as const,
  keyword: (term: string) => ['search-page', 'keyword', term] as const,
  unique: (target: MapTarget, field: string, gov?: string, village?: string) =>
    ['search-page', 'unique', targetKey(target), field, gov ?? '', village ?? ''] as const,
};

/** `null` = the per-user request quota said no (a message was already shown). */
export type Outcome<T> = T | null;

/**
 * Everything of one type that matches the filters (legacy executeSearch): counted against the quota, then one request for
 * the whole layer slice. Sorting / paging happen in the page.
 */
export function useCategoryResults(target: MapTarget | null, conditions: SearchCondition[]) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: target ? searchPageKeys.category(target, conditions) : ['search-page', 'category', 'none'],
    enabled: !!target,
    queryFn: async ({ signal }): Promise<Outcome<SearchResult[]>> => {
      if (!target) return [];
      if (!(await passesSearchQuota('no_map_search', t(targetLabelKey(target)), t, 'quick_search'))) return null;
      const fc = await searchApi.search({ ...targetToApi(target), conditions }, signal);
      return toResults(fc, target);
    },
    ...geoQueryOptions,
  });
}

/** Keyword box (legacy market-search): text over services + real estate + checkpoint / fuel status words, ranked. */
export function useKeywordResults(term: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: searchPageKeys.keyword(term),
    enabled: term.length >= KEYWORD_MIN_CHARS,
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }): Promise<Outcome<GlobalHit[]>> => {
      if (!(await passesSearchQuota('global_search', term, t, 'quick_search'))) return null;
      return fetchGlobalHits(term, signal);
    },
    select: (hits) =>
      hits && rankHits(hits, term, (target) => t(targetLabelKey(target))),
    ...geoQueryOptions,
  });
}

/** Values a dropdown offers (governorates, towns, places, names), narrowed by the governorate / town already chosen. */
export function useUniqueValues(target: MapTarget, field: string, conditions: SearchCondition[]) {
  const cascade = cascadeFilters(field, conditions);
  return useQuery({
    queryKey: searchPageKeys.unique(target, field, cascade.gov_a, cascade.village_a),
    queryFn: ({ signal }) => searchApi.uniqueValues({ ...targetToApi(target), field, ...cascade }, signal),
    staleTime: 5 * 60_000,
    select: (d) => (d.values ?? []).map(String).sort((a, b) => a.localeCompare(b, 'ar')),
  });
}
