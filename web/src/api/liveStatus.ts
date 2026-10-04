import { useQuery } from '@tanstack/react-query';
import { geoQueryOptions } from './queryClient';
import { searchApi } from './search';
import { WIDGETS_REFRESH_MS, widgetsApi, widgetsKeys, type WidgetsData } from './widgets';

export type { WidgetsData };

// "Road checkpoint status" / "fuel station status" lists (legacy widgets-ticker.js portal cards).
// Rows come from the live service layers; the "last updated" stamps from GET /api/widgets-data.

export type StatusLayer = 'road_barriers' | 'fuel_stations';

/** Legacy refreshed both lists every minute while the tab was visible. */
export const STATUS_REFRESH_MS = WIDGETS_REFRESH_MS;

export const liveStatusApi = {
  /** Every checkpoint / station (the server returns only active ones, ordered by `display_order`, max 2000). */
  rows: (layer: StatusLayer, signal?: AbortSignal) =>
    searchApi.search({ layer, workspace: 'services' }, signal),
  /** The whole public widgets response (same request the portal cards use); the status pages read the two stamps. */
  updatedAt: (signal?: AbortSignal) => widgetsApi.data(signal),
};

export const liveStatusKeys = {
  rows: (layer: StatusLayer) => ['status-rows', layer] as const,
  updatedAt: widgetsKeys.data,
};

/** Refetches every minute while the list is mounted and the tab visible. */
export function useStatusRows(layer: StatusLayer) {
  return useQuery({
    queryKey: liveStatusKeys.rows(layer),
    queryFn: ({ signal }) => liveStatusApi.rows(layer, signal),
    ...geoQueryOptions,
    staleTime: STATUS_REFRESH_MS / 2,
    refetchInterval: STATUS_REFRESH_MS,
  });
}

export function useStatusUpdatedAt(layer: StatusLayer) {
  return useQuery({
    queryKey: liveStatusKeys.updatedAt,
    queryFn: ({ signal }) => liveStatusApi.updatedAt(signal),
    staleTime: STATUS_REFRESH_MS / 2,
    refetchInterval: STATUS_REFRESH_MS,
    select: (d) => (layer === 'road_barriers' ? d.road_status_updated_at : d.fuel_status_updated_at),
  });
}
