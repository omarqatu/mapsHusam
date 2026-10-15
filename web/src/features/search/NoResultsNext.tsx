import { Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { targetKey, targetLabelKey } from '../map/targets';
import { usePopularTargets } from './popular';

const CHIP =
  'inline-flex h-8 items-center rounded-full border border-line bg-surface px-3 text-sm font-semibold text-fg transition-colors hover:border-brand hover:bg-brand-light hover:text-brand-fg';

/**
 * What to do after a search found nothing (no dead end): the types this viewer can browse, the full search page when
 * the search came from the map, and adding one's own business.
 */
export default function NoResultsNext({ term, fromMap = false }: { term?: string; fromMap?: boolean }) {
  const { t } = useTranslation();
  const popular = usePopularTargets();
  return (
    <div className="flex flex-col items-center gap-3 pt-1">
      {popular.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="text-sm text-muted">{t('search.next.browse')}</span>
          {popular.map((x) => (
            <Link key={targetKey(x)} to={`/search?type=${encodeURIComponent(targetKey(x))}`} className={CHIP}>
              {t(targetLabelKey(x))}
            </Link>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-semibold">
        {fromMap && (
          <Link
            to={term ? `/search?q=${encodeURIComponent(term)}` : '/search'}
            className="inline-flex items-center gap-1 text-brand-fg hover:underline"
          >
            <Search className="h-4 w-4" aria-hidden />
            {t('search.next.fullSearch')}
          </Link>
        )}
        <Link to="/add-listing" className="inline-flex items-center gap-1 text-brand-fg hover:underline">
          <Plus className="h-4 w-4" aria-hidden />
          {t('search.next.addListing')}
        </Link>
      </div>
    </div>
  );
}
