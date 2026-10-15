import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { SearchX } from 'lucide-react';
import { searchApi } from '@/api/search';
import ButtonLink from '@/components/ui/ButtonLink';
import EmptyState from '@/components/ui/EmptyState';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { targetFromKey, targetToApi } from '../map/targets';
import { toResults } from '../map/search/results';
import { listingTitle } from '../map/popup/featureModel';
import ListingDetails from './ListingDetails';

/**
 * One listing's own page (`/l/<type>/<id>`): what a shared link opens. Public — the server applies the same rules as the
 * search (hidden types, withdrawn / expired listings, visitor contact), so a link never shows more than the search does.
 */
export default function ListingPage() {
  const { t } = useTranslation();
  const { key, id } = useParams();
  const target = targetFromKey(key);
  const { data, isPending, isError } = useQuery({
    queryKey: ['listing-page', key, id],
    queryFn: ({ signal }) => searchApi.batch({ ...targetToApi(target!), ids: [id!] }, signal),
    enabled: !!target && !!id,
    select: (fc) => toResults(fc, target)[0] ?? null,
  });
  const title = data ? listingTitle(data.target, data.props, t) : null;
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    document.title = `${title} · ${t('app.name')}`;
    return () => {
      document.title = before;
    };
  }, [title, t]);

  if (target && id && isPending) return <CenteredSpinner />;
  if (!data)
    return (
      <EmptyState
        icon={<SearchX className="h-10 w-10" aria-hidden />}
        title={t(isError ? 'listing.loadFailed' : 'listing.notFound')}
        description={t('listing.notFoundHint')}
        action={<ButtonLink to="/search">{t('listing.browse')}</ButtonLink>}
      />
    );
  return (
    <article className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-sm">
      <h1 className="mb-3 text-xl font-bold text-fg">{title}</h1>
      <ListingDetails entry={{ r: data }} contactSource="quick_search" />
    </article>
  );
}
