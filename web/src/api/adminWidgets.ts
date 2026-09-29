import { api } from './client';

// "Live information centre" administration (legacy widgets-admin.html): seven hand-edited groups stored as JSON in
// `widgets_manual_groups`, plus the status columns of the road-checkpoint and fuel-station features. Admin only.

export const WIDGET_GROUPS = [
  'currency',
  'gold',
  'weather',
  'fuel',
  'transport_inter_city',
  'transport_intra_city',
  'events',
] as const;
export type WidgetGroupKey = (typeof WIDGET_GROUPS)[number];

/** One editable row; every value is text (the server stores whatever JSON it is given). */
export type WidgetItem = Record<string, string>;

export interface WidgetGroupData {
  data: WidgetItem[];
  updated_at: string | null;
}
export type AdminWidgetsResponse = {
  success: true;
  groups: Partial<Record<WidgetGroupKey, WidgetGroupData>>;
};

/** Status columns come back as numbers (or null when never set) but are sent as text/number alike. */
export type StatusValue = number | string | null;

export interface RoadBarrierRow {
  id: number;
  name: string | null;
  stop: StatusValue;
  stop2: StatusValue;
  updated_at: string | null;
}
export interface FuelStationRow {
  id: number;
  name: string | null;
  diesel: StatusValue;
  banzen95: StatusValue;
  banzen98: StatusValue;
  updated_at: string | null;
}
export interface RoadFuelFeatures {
  success: true;
  roadBarriers: RoadBarrierRow[];
  fuelStations: FuelStationRow[];
}

export type FuelField = 'diesel' | 'banzen95' | 'banzen98';
export type FeatureLayer = 'road_barriers' | 'fuel_stations';

/** Road: `stop` = inbound, `stop2` = outbound; values '0'..'4'. Fuel: '0' available, '1' unavailable. */
export interface RoadEdit {
  stop?: string;
  stop2?: string;
}
export type FuelEdit = Partial<Record<FuelField, string>>;

type Ok = { success: true };
type Updated = { success: true; updated: number };

export const adminWidgetsApi = {
  groups: () => api.get<AdminWidgetsResponse>('/api/admin/widgets-data'),
  saveGroup: (key: WidgetGroupKey, items: WidgetItem[]) =>
    api.post<{ success: true; message: string }>(`/api/admin/widgets-data/${key}`, { items }),
  features: () => api.get<RoadFuelFeatures>('/api/admin/road-fuel-features'),
  reorder: (layer: FeatureLayer, orderedIds: number[]) =>
    api.post<Ok>('/api/admin/reorder-features', { layer, orderedIds }),
  updateRoad: (id: number, edit: RoadEdit) => api.post<Ok>('/api/admin/update-road-barrier', { id, ...edit }),
  /** Writes all three columns as given (null stays null). */
  updateFuel: (id: number, v: Record<FuelField, StatusValue>) =>
    api.post<Ok>('/api/admin/update-fuel-station', { id, ...v }),
  bulkRoad: (ids: number[], edit: RoadEdit) =>
    api.post<Updated>('/api/admin/bulk-update-road-barriers', { ids, ...edit }),
  bulkFuel: (ids: number[], edit: FuelEdit) =>
    api.post<Updated>('/api/admin/bulk-update-fuel-stations', { ids, ...edit }),
  batchRoad: (items: ({ id: number } & RoadEdit)[]) =>
    api.post<Updated>('/api/admin/batch-update-road-barriers', { items }),
  batchFuel: (items: ({ id: number } & FuelEdit)[]) =>
    api.post<Updated>('/api/admin/batch-update-fuel-stations', { items }),
};
