import clsx from 'clsx';
import { Copy, List, Printer } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import RatingSummary from '@/components/ui/RatingSummary';
import { toast } from '@/components/ui/toastStore';
import { useOlMap } from '../MapContext';
import { useMapUi } from '../store';
import { copyText } from '@/lib/clipboard';
import { formatDateTime } from '@/lib/format';
import { availability, priceLabel, text, type SelectedFeature } from '../popup/featureModel';
import { AvailabilityText } from '../popup/AvailabilityText';
import { hasPrice, isRoadBarrier, priceCurrencyDefault } from '../targets';
import MapSheet from '../panels/MapSheet';
import { targetLabelKey } from '../targets';
import { manualStars } from '../extras/featured';
import { formatDistance } from './nearby';
import { printResults } from './printResults';
import ResultContact from './ResultContact';
import { toSelected, type SearchResult } from './results';
import { buildShareLink, encodeShareState } from './shareLink';
import { useSearchUi } from './store';
import TargetIcon from '../TargetIcon';

/** A card and a row show the same feature when both the id and the point match (ids repeat across types). */
const isSameFeature = (s: SelectedFeature | null, r: SearchResult) =>
  !!s && s.id === r.id && s.coordinate[0] === r.center[0] && s.coordinate[1] === r.center[1];

function ResultRow({
  r,
  index,
  active,
  onOpen,
}: {
  r: SearchResult;
  index: number;
  active: boolean;
  onOpen: () => void;
}) {
  const { t, i18n } = useTranslation();
  const p = r.props;
  const typeTitle = t(targetLabelKey(r.target));
  const place = [text(p.location_name) || text(p.location), text(p.village_a)].filter(Boolean).join(' · ');
  const name = text(p.name) || typeTitle;
  const priced = hasPrice(r.target);
  const price = priced ? priceLabel(p, t, i18n.language, priceCurrencyDefault(r.target)) : null;
  const state = availability(p);
  const barrier = isRoadBarrier(r.target);

  return (
    <li
      className={clsx(
        'rounded-xl border p-3',
        active ? 'border-brand bg-brand-light/40' : 'border-line bg-surface/60',
      )}
    >
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 text-start">
        <span className="mt-0.5 w-5 shrink-0 text-center text-xs font-bold text-muted">{index + 1}</span>
        <span aria-hidden className="text-xl">
          <TargetIcon target={r.target} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-fg" dir="auto">
            {name}
          </span>
          <span className="block truncate text-xs text-muted">
            {typeTitle}
            {place ? ` · ${place}` : ''}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            {r.rating > 0 && <RatingSummary value={manualStars(r.rating)} />}
            {!barrier && state && <AvailabilityText value={state} />}
            {price && <span>{price}</span>}
            {priced && text(p.area) && (
              <span>
                {text(p.area)} {t('map.areaUnit')}
              </span>
            )}
            {r.distance !== undefined && (
              <span className="font-semibold text-brand-fg">{formatDistance(r.distance, t)}</span>
            )}
          </span>
        </span>
      </button>
      <ResultContact r={r} className="mt-2 ps-8" />
    </li>
  );
}

/** The list of the current search's results. Tap a row → fly there and open its details card. */
export default function ResultsPanel({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const map = useOlMap();
  const results = useSearchUi((s) => s.results);
  const setResults = useSearchUi((s) => s.setResults);
  const selected = useMapUi((s) => s.selected);
  const setSelected = useMapUi((s) => s.setSelected);

  const close = () => setResults(null);

  if (!results) return null;

  const open = (r: SearchResult) => {
    map?.getView().animate({ center: r.center, zoom: 19, duration: 800 });
    setSelected(toSelected(r));
  };

  const copyLink = async () => {
    if (!results.share) return toast.warning(t('search.results.noLink'));
    const ok = await copyText(
      buildShareLink(results.share, window.location.origin, window.location.pathname),
    );
    if (ok) toast.success(t('search.results.linkCopied'));
    else toast.error(t('search.results.linkFailed'));
  };

  const print = () => {
    const ok = printResults(results.items, (r) => t(targetLabelKey(r.target)), {
      title: `${t('search.results.reportTitle')} — ${results.title}`,
      date: `${t('search.results.printedOn')} ${formatDateTime(new Date(), i18n.language)}`,
      columns: ['#', t('popup.name'), t('search.type'), t('popup.place'), t('popup.call')],
      dir: i18n.language === 'ar' ? 'rtl' : 'ltr',
      lang: i18n.language,
    });
    if (!ok) toast.warning(t('search.results.popupBlocked'));
  };

  const iconBtn = 'rounded p-1.5 text-muted hover:bg-subtle';
  return (
    <MapSheet
      side="start"
      label={t('search.results.title')}
      className={className}
      onClose={close}
      title={
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm">
            {t('search.results.title')} · {t('search.results.count', { count: results.items.length })}
            <span className="block truncate text-xs font-normal text-muted">{results.title}</span>
          </span>
          <span className="flex shrink-0">
            <button
              type="button"
              className={iconBtn}
              onClick={() => void copyLink()}
              aria-label={t('search.results.copyLink')}
              title={t('search.results.copyLink')}
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconBtn}
              onClick={print}
              aria-label={t('search.results.print')}
              title={t('search.results.print')}
            >
              <Printer className="h-4 w-4" />
            </button>
            {results.share?.type === 'attribute' && (
              <Link
                to={`/search?resultsShare=${encodeShareState(results.share)}`}
                className={iconBtn}
                aria-label={t('search.results.openAsList')}
                title={t('search.results.openAsList')}
              >
                <List className="h-4 w-4" />
              </Link>
            )}
          </span>
        </div>
      }
    >
      <ul className="space-y-2">
        {results.items.map((r, i) => (
          <ResultRow key={r.key} r={r} index={i} active={isSameFeature(selected, r)} onOpen={() => open(r)} />
        ))}
      </ul>
    </MapSheet>
  );
}
