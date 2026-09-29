import { useMemo, useState } from 'react';
import { ArrowRight, Copy, LocateFixed, Map as MapIcon, Printer, SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import SelectInput from '@/components/ui/SelectInput';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/toastStore';
import { copyText } from '@/lib/clipboard';
import { formatDateTime } from '@/lib/format';
import type { Coordinate } from '../map/config';
import FeaturedCard from '../map/extras/FeaturedCard';
import { GeoError, locateOnce } from '../map/geolocate';
import { printResults } from '../map/search/printResults';
import { targetIcon, targetLabelKey } from '../map/targets';
import FiltersPanel from './FiltersPanel';
import PagedGrid from './PagedGrid';
import { SERVER_ROW_CAP, useCategoryResults } from './queries';
import { mapSearchPath, type Selection } from './selection';
import { EMPTY_FILTERS, fromConditions, toConditions, filterFields } from './filters';
import { sortResults, type SortMode } from './sort';

interface Props {
  selection: Selection;
  onChange: (next: Selection) => void;
  onBack: () => void;
}

/** One type opened: filters, sort, the cards, and the print / link / map actions. */
export default function CategoryResults({ selection, onChange, onBack }: Props) {
  const { t, i18n } = useTranslation();
  const { target, conditions } = selection;
  const fields = useMemo(() => filterFields(target), [target]);
  const state = useMemo(() => fromConditions(conditions), [conditions]);
  const query = useCategoryResults(target, conditions);
  const [sort, setSort] = useState<SortMode>('rating');
  const [origin, setOrigin] = useState<Coordinate | null>(null);
  const [locating, setLocating] = useState(false);

  const title = t(targetLabelKey(target));
  const isRealEstate = target.kind === 'realEstate';
  const canSortByPrice = isRealEstate && state.currency !== '';

  const items = useMemo(
    () => (query.data ? sortResults(query.data, sort, origin) : []),
    [query.data, sort, origin],
  );

  const pickSort = (mode: SortMode) => {
    if (mode !== 'nearest' || origin) return setSort(mode);
    setLocating(true);
    locateOnce()
      .then((c) => {
        setOrigin(c);
        setSort('nearest');
      })
      .catch((e: unknown) => toast.error(t(e instanceof GeoError ? e.messageKey : 'map.gps.failed')))
      .finally(() => setLocating(false));
  };

  const copyLink = async () => {
    const ok = await copyText(window.location.href);
    if (ok) toast.success(t('search.results.linkCopied'));
    else toast.error(t('search.results.linkFailed'));
  };

  const print = () => {
    const ok = printResults(items, (r) => t(targetLabelKey(r.target)), {
      title: `${t('search.results.reportTitle')} — ${title}`,
      date: `${t('search.results.printedOn')} ${formatDateTime(new Date(), i18n.language)}`,
      columns: ['#', t('popup.name'), t('search.type'), t('popup.place'), t('popup.call')],
      dir: i18n.language === 'ar' ? 'rtl' : 'ltr',
      lang: i18n.language,
    });
    if (!ok) toast.warning(t('search.results.popupBlocked'));
  };

  const sortOptions = [
    { value: 'rating', label: t('searchPage.sort.rating') },
    { value: 'name', label: t('searchPage.sort.name') },
    { value: 'nearest', label: t('searchPage.sort.nearest') },
    ...(canSortByPrice
      ? [
          { value: 'priceAsc', label: t('searchPage.sort.priceAsc') },
          { value: 'priceDesc', label: t('searchPage.sort.priceDesc') },
        ]
      : []),
  ];
  // A price sort only makes sense with one currency chosen; falling back keeps the list and the picker in step.
  const effectiveSort: SortMode =
    (sort === 'priceAsc' || sort === 'priceDesc') && !canSortByPrice ? 'rating' : sort;

  const data = query.data;
  const capped = !!data && data.length >= SERVER_ROW_CAP;
  const listKey = `${JSON.stringify(conditions)}|${effectiveSort}|${origin?.join(',') ?? ''}`;

  return (
    <section aria-labelledby="category-title" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={onBack}
          startIcon={<ArrowRight className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />}
        >
          {t('searchPage.backToCategories')}
        </Button>
        <h2 id="category-title" className="flex items-center gap-2 text-xl font-black text-fg">
          <span aria-hidden>{targetIcon(target)}</span>
          {title}
        </h2>
      </div>

      <FiltersPanel
        target={target}
        state={state}
        onChange={(next) => onChange({ target, conditions: toConditions(next, fields) })}
        onReset={() => onChange({ target, conditions: toConditions(EMPTY_FILTERS, fields) })}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <p role="status" aria-live="polite" className="text-base font-bold text-fg">
          {query.isFetching && !data
            ? t('searchPage.searching')
            : data
              ? t('searchPage.resultCount', { count: data.length })
              : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-fg">{t('searchPage.sortBy')}</span>
            <SelectInput
              inputSize="sm"
              className="w-44"
              aria-label={t('searchPage.sortBy')}
              value={effectiveSort}
              disabled={locating}
              onChange={(e) => pickSort(e.target.value as SortMode)}
              options={sortOptions}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copyLink()}
            startIcon={<Copy className="h-4 w-4" aria-hidden />}
          >
            <span className="max-sm:sr-only">{t('search.results.copyLink')}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={print}
            disabled={items.length === 0}
            startIcon={<Printer className="h-4 w-4" aria-hidden />}
          >
            <span className="max-sm:sr-only">{t('search.results.print')}</span>
          </Button>
          <Link
            to={mapSearchPath(selection)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-fg hover:bg-subtle"
          >
            <MapIcon className="h-4 w-4" aria-hidden />
            {t('searchPage.openOnMap')}
          </Link>
        </div>
      </div>
      {origin && effectiveSort === 'nearest' && (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <LocateFixed className="h-4 w-4" aria-hidden /> {t('searchPage.sortedFromYou')}
        </p>
      )}

      {query.isPending ? (
        <CenteredSpinner minHeight="12rem" />
      ) : query.isError ? (
        <AlertMessage type="error" message={t('search.failed')} />
      ) : data === null ? (
        <AlertMessage type="warning" message={t('searchPage.quotaBlocked')} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-10 w-10" aria-hidden />}
          title={t('searchPage.noResults')}
          description={t('searchPage.noResultsHint')}
        />
      ) : (
        <>
          {capped && <AlertMessage type="info" message={t('searchPage.capped', { count: SERVER_ROW_CAP })} />}
          <PagedGrid
            key={listKey}
            items={items}
            getKey={(r) => r.key}
            render={(r) => <FeaturedCard entry={{ r }} mode="all" customerRatings />}
          />
        </>
      )}
    </section>
  );
}
