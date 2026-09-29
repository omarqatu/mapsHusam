import { useMemo, useState } from 'react';
import { ListFilter, LocateFixed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/toastStore';
import type { Coordinate } from '../config';
import { GeoError, locateOnce } from '../geolocate';
import { useOlMap } from '../MapContext';
import { useSearchUi } from '../search/store';
import { targetIcon, targetFromKey } from '../targets';
import FeaturedCard from './FeaturedCard';
import { nearestEntries } from './featured';
import { useNearbyCandidates } from './queries';
import TypeFilter from './TypeFilter';

const PRESETS = ['road_barriers', 'fuel_stations'] as const;

/**
 * "Services near me": share the location once, then the 10 closest features of the chosen types (all types by default).
 * Legacy needed an "apply" click after ticking types; here the list follows the ticks.
 */
export default function NearMeSection() {
  const { t } = useTranslation();
  const map = useOlMap();
  const [center, setCenter] = useState<Coordinate | null>(null);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const candidates = useNearbyCandidates(center !== null);

  const locate = (preset?: string) => {
    if (preset) {
      setSelected(new Set([preset]));
      setFilterOpen(true);
    }
    setLocating(true);
    locateOnce()
      .then((c) => {
        setCenter(c);
        // Same blue dot as the "search near a location" tab.
        useSearchUi.getState().setNearbyCenter(c);
        map?.getView().animate({ center: c, zoom: 18, duration: 800 });
      })
      .catch((e: unknown) => toast.error(t(e instanceof GeoError ? e.messageKey : 'map.gps.failed')))
      .finally(() => setLocating(false));
  };

  const nearest = useMemo(
    () => (center && candidates.data ? nearestEntries(candidates.data, center, selected) : []),
    [center, candidates.data, selected],
  );

  const status = locating
    ? t('search.nearby.locating')
    : !center
      ? t('extras.featured.nearHint')
      : candidates.isPending
        ? t('extras.featured.nearLoading')
        : t('extras.featured.nearReady', { count: nearest.length });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => locate()}
          loading={locating}
          startIcon={<LocateFixed className="h-4 w-4" />}
        >
          {t('extras.featured.myLocation')}
        </Button>
        {PRESETS.map((key) => {
          const target = targetFromKey(key);
          return (
            target && (
              <Button key={key} size="sm" variant="secondary" disabled={locating} onClick={() => locate(key)}>
                <span aria-hidden>{targetIcon(target)}</span> {t(`services.${key}`)}
              </Button>
            )
          );
        })}
      </div>
      <p className="flex items-center gap-2 text-sm text-muted" role="status" aria-live="polite">
        {center && candidates.isPending && <Spinner size="sm" />}
        {status}
      </p>

      {center && (
        <>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-fg"
          >
            <ListFilter className="h-4 w-4" aria-hidden />
            {t('extras.featured.filterByType')}
            {selected.size > 0 && ` (${selected.size})`}
          </button>
          {filterOpen && (
            <div className="space-y-2">
              <TypeFilter selected={selected} onChange={setSelected} />
              {selected.size > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  {t('extras.featured.showAllTypes')}
                </Button>
              )}
            </div>
          )}
          {candidates.isError && <AlertMessage type="error" message={t('extras.featured.failed')} />}
          {candidates.data && nearest.length === 0 && (
            <p className="text-sm text-muted">{t('extras.featured.nearNone')}</p>
          )}
          <div className="space-y-2">
            {nearest.map((r) => (
              <FeaturedCard key={r.key} entry={{ r }} mode="all" badge={t('extras.featured.badge.near')} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
