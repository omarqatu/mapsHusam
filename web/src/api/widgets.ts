import { api } from './client';
import type { WidgetGroupKey } from './adminWidgets';

// The public "live information centre" data (legacy widgets-ticker.js `fetchRemoteWidgetsData`): the seven hand-edited
// groups the admin saves on /admin/widgets, plus the "last update" stamps of the road / fuel status layers.

/** One stored group. `items` is whatever JSON the admin saved (normally an array of text rows, see `features/widgets/model`). */
export interface PublicWidgetGroup {
  items: unknown;
  /** ISO timestamp of the last save. */
  updated_at: string | null;
}

export interface WidgetsData {
  success: boolean;
  /** A group nobody has saved yet is absent. (The admin endpoint calls the same field `data`.) */
  groups?: Partial<Record<WidgetGroupKey, PublicWidgetGroup>>;
  /** Latest `updated_at` over road_barriers / fuel_stations rows (ISO string, null when there are none). */
  road_status_updated_at: string | null;
  fuel_status_updated_at: string | null;
}

export const widgetsApi = {
  data: (signal?: AbortSignal) => api.get<WidgetsData>('/api/widgets-data', undefined, { signal }),
};

/** Legacy refreshed the groups and both status lists every minute while the tab was visible. */
export const WIDGETS_REFRESH_MS = 60_000;

export const widgetsKeys = {
  data: ['widgets-data', 'status-times'] as const,
};
