import { useMemo } from 'react';
import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import EmptyState from '@/components/ui/EmptyState';
import { CenteredSpinner } from '@/components/ui/Spinner';
import FeaturedCard from '../map/extras/FeaturedCard';
import { roadBarrierStatus } from '../map/config';
import type { GlobalHit } from '../map/search/globalSearch';
import PagedGrid from './PagedGrid';
import { KEYWORD_LIMIT, useKeywordResults } from './queries';

/** Why a keyword hit matched when it came from a status word ("closed, inbound", "diesel available"). */
function useReason() {
  const { t } = useTranslation();
  return (h: GlobalHit) => {
    if (h.reason?.kind === 'stop')
      return t(`search.reason.stop.${h.reason.direction}`, {
        status: t(`roadStatus.${roadBarrierStatus(h.reason.value).key}`),
      });
    if (h.reason?.kind === 'fuel') return t('search.reason.fuel', { fuel: t(`popup.fuel.${h.reason.fuel}`) });
    return '';
  };
}

/** Results of the keyword box: the best 50 hits as the same cards the categories use. */
export default function KeywordResults({ term }: { term: string }) {
  const { t } = useTranslation();
  const query = useKeywordResults(term);
  const reason = useReason();
  const hits = useMemo(() => query.data?.slice(0, KEYWORD_LIMIT) ?? [], [query.data]);

  return (
    <section aria-labelledby="keyword-title" aria-busy={query.isFetching} className="space-y-3">
      <h2 id="keyword-title" className="text-lg font-bold text-fg">
        {t('searchPage.keywordTitle', { term })}
      </h2>
      {query.isPending ? (
        <CenteredSpinner minHeight="10rem" />
      ) : query.isError ? (
        <AlertMessage type="error" message={t('search.failed')} />
      ) : query.data === null ? (
        <AlertMessage type="warning" message={t('searchPage.quotaBlocked')} />
      ) : hits.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-10 w-10" aria-hidden />}
          title={t('searchPage.noKeywordResults', { term })}
          description={t('searchPage.noKeywordHint')}
        />
      ) : (
        <>
          <p role="status" className="text-sm font-semibold text-muted">
            {t('search.results.count', { count: hits.length })}
          </p>
          <PagedGrid
            key={term}
            items={hits}
            getKey={(h) => h.result.key}
            render={(h) => (
              <FeaturedCard entry={{ r: h.result }} mode="all" note={reason(h)} customerRatings />
            )}
          />
        </>
      )}
    </section>
  );
}
