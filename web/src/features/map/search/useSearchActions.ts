import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/client';
import type { MapEventType } from '@/api/mapEvents';
import { searchApi, type SearchCondition, type SearchQuery } from '@/api/search';
import { toast } from '@/components/ui/toastStore';
import { passesSearchQuota } from '@/lib/searchQuota';
import type { Coordinate } from '../config';
import { useOlMap } from '../MapContext';
import { useMapUi } from '../store';
import { targetKey, targetLabelKey, targetFromKey, targetToApi, type MapTarget } from '../targets';
import { findNearby, type NearbyExtra } from './nearby';
import type { ShareState } from './shareLink';
import { toResults, byRatingDesc } from './results';
import { useSearchUi } from './store';

let controller: AbortController | null = null;

/** All the ways to run a map search. Each one: quota → fetch (previous search aborted) → results into the store. */
export function useSearchActions() {
  const { t } = useTranslation();
  const map = useOlMap();

  /** Shared skeleton: one search at a time; a newer search cancels the older one (legacy could show stale answers). */
  const run = useCallback(
    async <T>(
      event: MapEventType,
      quotaLabel: string,
      task: (signal: AbortSignal) => Promise<T>,
    ): Promise<T | null> => {
      if (!(await passesSearchQuota(event, quotaLabel, t))) return null;
      controller?.abort();
      const mine = (controller = new AbortController());
      useSearchUi.getState().setBusy(true);
      try {
        return await task(mine.signal);
      } catch (e) {
        if (mine.signal.aborted) return null;
        toast.error(e instanceof ApiError && e.status === 0 ? t('errors.network') : t('search.failed'));
        return null;
      } finally {
        if (controller === mine) useSearchUi.getState().setBusy(false);
      }
    },
    [t],
  );

  const show = useCallback(
    (r: Parameters<ReturnType<typeof useSearchUi.getState>['setResults']>[0]) => {
      if (!r || r.items.length === 0) {
        useSearchUi.getState().setResults(null);
        toast.info(t('search.noResults'));
        return false;
      }
      useSearchUi.getState().setResults(r);
      return true;
    },
    [t],
  );

  /** Everything of one type inside the current map view (legacy quick search). */
  const quick = useCallback(
    async (target: MapTarget, bboxOverride?: string) => {
      const title = t(targetLabelKey(target));
      const extent = bboxOverride
        ? bboxOverride.split(',').map(Number)
        : map?.getView().calculateExtent(map.getSize());
      if (!extent) return;
      const api = targetToApi(target);
      const items = await run('quick_search', title, async (signal) =>
        toResults(await searchApi.search({ ...api, bbox: extent }, signal), target).sort(byRatingDesc),
      );
      if (!items) return;
      if (items.length === 0) {
        useSearchUi.getState().setResults(null);
        toast.info(t('search.noneInArea', { type: title }));
        return;
      }
      show({
        title,
        items,
        nearby: null,
        fitMaxZoom: 19,
        share: {
          type: 'quick',
          target: targetKey(target),
          bbox: extent.join(','),
        },
      });
    },
    [map, run, show, t],
  );

  /** Type + conditions across the whole layer (legacy smart search). */
  const smart = useCallback(
    async (target: MapTarget, conditions: SearchCondition[]) => {
      const title = t(targetLabelKey(target));
      const query: SearchQuery = { ...targetToApi(target), conditions };
      const items = await run('attribute_search', title, async (signal) =>
        toResults(await searchApi.search(query, signal), target).sort(byRatingDesc),
      );
      if (!items) return;
      show({
        title,
        items,
        nearby: null,
        fitMaxZoom: 19,
        share: { type: 'attribute', target: targetKey(target), conditions },
      });
    },
    [run, show, t],
  );

  /** Everything of one type around a point (legacy "search by location"); the layer is fetched whole and filtered here. */
  const nearby = useCallback(
    async (target: MapTarget, center: Coordinate, radiusText: string, extra: NearbyExtra) => {
      const title = t(targetLabelKey(target));
      const outcome = await run('location_search', title, async (signal) => {
        const all = toResults(await searchApi.search(targetToApi(target), signal), target);
        return findNearby(all, target, center, radiusText, extra);
      });
      if (!outcome) return;
      if (!outcome.ok) {
        toast.warning(t('search.invalidRadius'));
        return;
      }
      show({
        title,
        items: outcome.results,
        nearby: { center, radius: outcome.radius },
        fitMaxZoom: 18,
        share: {
          type: 'location',
          target: targetKey(target),
          center,
          radius: radiusText.trim(),
          extra,
        },
      });
    },
    [run, show, t],
  );

  const clear = useCallback(() => {
    controller?.abort();
    useMapUi.getState().setSelected(null);
    useSearchUi.getState().setBusy(false);
    useSearchUi.getState().setResults(null);
  }, []);

  /** Re-run a search from a shared link (?resultsShare=). Returns false when the link can't be replayed. */
  const replay = useCallback(
    async (state: ShareState): Promise<boolean> => {
      const target = targetFromKey(state.target);
      if (!target) return false;
      if (state.type === 'quick') await quick(target, state.bbox);
      else if (state.type === 'attribute') await smart(target, state.conditions);
      else {
        useSearchUi.getState().setNearbyCenter(state.center);
        await nearby(
          target,
          state.center,
          state.radius,
          state.extra ?? { stop: '', fuel: { diesel: '', banzen95: '', banzen98: '' } },
        );
      }
      return true;
    },
    [nearby, quick, smart],
  );

  return { quick, smart, nearby, clear, replay };
}
