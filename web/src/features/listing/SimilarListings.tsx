import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { geoQueryOptions } from '@/api/queryClient';
import { searchApi } from '@/api/search';
import { toResults, type SearchResult } from '../map/search/results';
import { targetKey, targetToApi } from '../map/targets';
import ListingCard from '../search/ListingCard';
import ScrollRow from '../search/ScrollRow';
import { closestOthers } from './model';

/** "More like this" under a listing: same type, nearest first, as a row of the search page's cards. */
export default function SimilarListings({ of }: { of: SearchResult }) {
  const { t } = useTranslation();
  const id = useId();
  const { data } = useQuery({
    queryKey: ['listing-page', 'similar', targetKey(of.target), of.key],
    queryFn: async ({ signal }) => toResults(await searchApi.search(targetToApi(of.target), signal), of.target),
    select: (rows) => closestOthers(rows, of),
    staleTime: 5 * 60_000,
    ...geoQueryOptions,
  });
  if (!data?.length) return null;
  const title = t('listing.page.similar');
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className="flex items-center gap-2 text-lg font-black text-fg">
        <LayoutGrid className="h-5 w-5 text-brand-fg" aria-hidden /> {title}
      </h2>
      <ScrollRow label={title}>
        {data.map((r) => (
          <ListingCard key={r.key} entry={{ r }} className="w-64 shrink-0 snap-start" />
        ))}
      </ScrollRow>
    </section>
  );
}
