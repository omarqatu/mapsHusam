import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStatusRows, useStatusUpdatedAt, type StatusLayer } from '@/api/liveStatus';
import AlertMessage from '@/components/ui/AlertMessage';
import { CenteredSpinner } from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import SearchInput from '@/components/ui/SearchInput';
import { FUEL_FIELDS } from '../config';
import { barrierDirections, text } from '../popup/featureModel';
import { toResults, type SearchResult } from '../search/results';
import { targetFromKey, targetIcon } from '../targets';
import { BarrierBadges, FuelBadges } from './StatusBadges';
import { matchesQuery } from './status';
import UpdatedAgo from './UpdatedAgo';
import { useShowOnMap } from './useShowOnMap';
import { serviceLabelKey } from '../registry';

/** What the search box matches: the row's own text plus the status words it displays (legacy matched rendered text). */
function searchText(r: SearchResult, layer: StatusLayer, t: (k: string) => string) {
  const p = r.props;
  let status: string[];
  if (layer === 'road_barriers') {
    const { inbound, outbound } = barrierDirections(p);
    status = [t('popup.inbound'), t(`roadStatus.${inbound.key}`), t('popup.outbound')];
    status.push(outbound ? t(`roadStatus.${outbound.key}`) : t('popup.notSet'));
  } else {
    // Fuel names only: "available" is a substring of "not available", so the availability words would mislead.
    status = FUEL_FIELDS.map((f) => t(`popup.fuel.${f}`));
  }
  return [p.name, p.des, p.location_name, p.village_a, p.gov_a, ...status].map(text).join(' ');
}

/** Road checkpoint / fuel station status list (legacy widgets portal cards): searchable, auto-refreshing, tap → on the map. */
export default function StatusTab({
  layer,
  showUpdated = true,
  initialCount,
}: {
  layer: StatusLayer;
  /** False when the host shows the "last update" stamp itself (the portal card header). */
  showUpdated?: boolean;
  /** Show only this many rows until "show all" is tapped (a long list on a page); searching always searches every row. */
  initialCount?: number;
}) {
  const { t } = useTranslation();
  const rows = useStatusRows(layer);
  const updated = useStatusUpdatedAt(layer);
  const showOnMap = useShowOnMap();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const target = targetFromKey(layer);
  const all = useMemo(() => (rows.data && target ? toResults(rows.data, target) : []), [rows.data, target]);
  const shown = useMemo(
    () => all.filter((r) => matchesQuery(searchText(r, layer, t), query)),
    [all, layer, query, t],
  );

  const visible = initialCount && !expanded && !query.trim() ? shown.slice(0, initialCount) : shown;
  const refresh = () => {
    void rows.refetch();
    void updated.refetch();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {showUpdated ? <UpdatedAgo at={updated.data} now={updated.dataUpdatedAt} /> : <span />}
        <button
          type="button"
          onClick={refresh}
          disabled={rows.isFetching}
          aria-label={t('extras.status.refresh')}
          title={t('extras.status.refreshHint')}
          className="rounded p-1.5 text-muted hover:bg-subtle disabled:opacity-60"
        >
          <RefreshCw className={rows.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </button>
      </div>
      <SearchInput
        value={query}
        onChange={setQuery}
        debounceMs={150}
        placeholder={t(layer === 'road_barriers' ? 'extras.status.searchRoads' : 'extras.status.searchFuel')}
      />

      {rows.isPending ? (
        <CenteredSpinner minHeight="8rem" />
      ) : rows.isError ? (
        <AlertMessage type="error" message={t('extras.status.failed')} />
      ) : shown.length === 0 ? (
        <EmptyState title={t(all.length === 0 ? 'extras.status.empty' : 'extras.status.noMatch')} />
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => {
            const name = text(r.props.name) || t(serviceLabelKey(layer));
            const note = layer === 'road_barriers' ? text(r.props.des) : '';
            const place = text(r.props.location_name) || text(r.props.village_a);
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => showOnMap(r)}
                  className="w-full rounded-xl border border-line bg-surface/60 p-3 text-start hover:border-brand hover:bg-brand-light/30"
                >
                  <span className="flex items-start gap-2">
                    <span aria-hidden className="text-xl">
                      {targetIcon(r.target)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold text-fg" dir="auto">
                        {name}
                        {note && <span className="font-normal text-muted"> ({note})</span>}
                      </span>
                      {place && <span className="block truncate text-sm text-muted">{place}</span>}
                    </span>
                  </span>
                  <span className="mt-2 block">
                    {layer === 'road_barriers' ? (
                      <BarrierBadges props={r.props} />
                    ) : (
                      <FuelBadges props={r.props} />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {initialCount && !query.trim() && shown.length > initialCount && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full rounded-lg border border-line py-2 text-sm font-semibold text-brand-fg hover:bg-subtle"
        >
          {expanded ? t('common.showLess') : t('common.showAll', { count: shown.length })}
        </button>
      )}
    </div>
  );
}
