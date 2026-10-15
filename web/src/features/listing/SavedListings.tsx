import { useEffect, useId, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { searchApi } from '@/api/search';
import { targetFromKey, targetToApi } from '../map/targets';
import { toResults, type SearchResult } from '../map/search/results';
import ListingCard from '../search/ListingCard';
import ScrollRow from '../search/ScrollRow';
import { useSavedListings } from './savedStore';

/**
 * «المحفوظة»: the listings this device saved with the heart, read fresh (one request per type). Nothing at all while
 * there are none. A saved listing the server no longer returns (withdrawn, expired, hidden) is dropped from the list.
 */
export default function SavedListings() {
  const { t } = useTranslation();
  const headingId = useId();
  const items = useSavedListings((s) => s.items);
  const forget = useSavedListings((s) => s.forget);
  const byType = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const i of items) if (targetFromKey(i.key)) m.set(i.key, [...(m.get(i.key) ?? []), i.id]);
    return [...m];
  }, [items]);
  const queries = useQueries({
    queries: byType.map(([key, ids]) => ({
      queryKey: ['saved-listings', key, ids],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        searchApi.batch({ ...targetToApi(targetFromKey(key)!), ids }, signal),
      staleTime: 60_000,
    })),
  });

  const found = new Map<string, SearchResult>();
  queries.forEach((q, n) => {
    const [key] = byType[n];
    if (q.data)
      for (const r of toResults(q.data, targetFromKey(key))) if (r.id) found.set(`${key}:${r.id}`, r);
  });
  const done = queries.every((q) => q.isSuccess);
  const goneKey = done
    ? items
        .filter((i) => !found.has(`${i.key}:${i.id}`))
        .map((i) => `${i.key}:${i.id}`)
        .join(',')
    : '';
  useEffect(() => {
    if (!goneKey) return;
    forget(
      goneKey.split(',').map((g) => ({ key: g.slice(0, g.indexOf(':')), id: g.slice(g.indexOf(':') + 1) })),
    );
  }, [goneKey, forget]);

  const shown = items.map((i) => found.get(`${i.key}:${i.id}`)).filter((r): r is SearchResult => !!r);
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h2 id={headingId} className="flex items-center gap-2 text-xl font-black text-fg">
        <Heart className="h-5 w-5 fill-current text-danger" aria-hidden /> {t('listing.savedTitle')}
      </h2>
      <ScrollRow label={t('listing.savedTitle')}>
        {shown.map((r) => (
          <ListingCard key={r.key} entry={{ r }} customerRatings className="w-64 shrink-0 snap-start" />
        ))}
      </ScrollRow>
    </section>
  );
}
