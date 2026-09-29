import clsx from 'clsx';
import { Fuel, Map as MapIcon, Signpost, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useStatusUpdatedAt, type StatusLayer } from '@/api/liveStatus';
import { formatAgo, relativeUpdate } from '../map/extras/status';

interface Props {
  onRoads: () => void;
  onFuel: () => void;
}

const pill =
  'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold text-fg shadow-sm transition-colors hover:border-brand hover:text-brand-fg focus-visible:outline-2 focus-visible:outline-brand';

/** The dot is green while the list was updated within the day; grey (still) when it has gone stale or was never filled. */
const LiveDot = ({ fresh }: { fresh: boolean }) => (
  <span className="relative flex h-2 w-2" aria-hidden>
    {fresh && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok-solid opacity-75 motion-reduce:hidden" />}
    <span className={clsx('relative inline-flex h-2 w-2 rounded-full', fresh ? 'bg-ok-solid' : 'bg-muted/50')} />
  </span>
);

/** One status pill with its own "updated 5 minutes ago" (the stamp is the server's, refreshed every minute and on admin pushes). */
function StatusPill({ layer, icon: Icon, label, onClick }: { layer: StatusLayer; icon: LucideIcon; label: string; onClick: () => void }) {
  const { t, i18n } = useTranslation();
  const { data: at, dataUpdatedAt } = useStatusUpdatedAt(layer);
  const rel = relativeUpdate(at, dataUpdatedAt);
  const fresh = rel.kind === 'now' || (rel.kind === 'ago' && rel.unit !== 'day');
  const ago = rel.kind === 'now' ? t('extras.status.justNow') : rel.kind === 'ago' ? formatAgo(rel, i18n.language) : null;
  return (
    <button type="button" onClick={onClick} className={pill}>
      <LiveDot fresh={fresh} /> <Icon className="h-4 w-4 text-muted" aria-hidden /> {label}
      {ago && <span className={clsx('text-xs font-medium', rel.kind === 'now' ? 'text-ok' : 'text-muted')}>· {ago}</span>}
    </button>
  );
}

/** Under the search (legacy: the three coloured header buttons): road status, fuel-station status — and the map on phones. */
export default function LiveLinks({ onRoads, onFuel }: Props) {
  const { t } = useTranslation();
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:justify-center md:px-0 [&::-webkit-scrollbar]:hidden">
      <Link to="/" className={`${pill} md:hidden`}>
        <MapIcon className="h-4 w-4 text-brand-fg" aria-hidden /> {t('searchPage.goToMap')}
      </Link>
      <StatusPill layer="road_barriers" icon={Signpost} label={t('searchPage.roadStatus')} onClick={onRoads} />
      <StatusPill layer="fuel_stations" icon={Fuel} label={t('searchPage.fuelStatus')} onClick={onFuel} />
    </div>
  );
}
