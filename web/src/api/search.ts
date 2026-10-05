import { api } from './client';

// GET /api/search-features and /api/get-unique-values (server.js ~1600-1900). Read from the handlers, not guessed.

export type Workspace = 'realestate' | 'services';
/** `>` is inclusive (>=) and `<` is inclusive (<=) on the server; labels in the UI say ≥ / ≤. */
export type SearchOperator = '=' | 'contains' | '>' | '<';

export interface SearchCondition {
  field: string;
  operator: SearchOperator;
  value: string;
}

export interface SearchQuery {
  /** ApartRent | ApartSale | LandSale | a service discriminator | `service_all` (every service). */
  layer: string;
  workspace: Workspace;
  conditions?: SearchCondition[];
  /** [minX, minY, maxX, maxY] in EPSG:28191 — points by x/y columns, polygons by ST_Intersects. */
  bbox?: readonly number[];
  /** Columns that must hold a value (not NULL, not ''): the server's `notempty` operator. */
  notEmpty?: readonly string[];
}

/**
 * The server skips a condition whose `value_N` is missing or empty, so `notempty` sends a placeholder it never reads
 * (legacy sent none, and its "not empty" filter silently matched every row).
 */
const NOT_EMPTY_PLACEHOLDER = '1';

/** Query-string fields. Same-field conditions are OR-ed by the server, different fields AND-ed; max 2000 rows. */
export function buildSearchParams(q: SearchQuery): Record<string, string> {
  const params: Record<string, string> = { layer: q.layer, workspace: q.workspace };
  if (q.bbox) params.bbox = q.bbox.join(',');
  const conditions: { field: string; operator: string; value: string }[] = [
    ...(q.conditions ?? []).filter((c) => c.field && c.value !== ''),
    ...(q.notEmpty ?? []).map((field) => ({ field, operator: 'notempty', value: NOT_EMPTY_PLACEHOLDER })),
  ];
  conditions.forEach((c, i) => {
    params[`field_${i}`] = c.field;
    params[`operator_${i}`] = c.operator;
    params[`value_${i}`] = c.value;
  });
  if (conditions.length > 0) params.conditions_count = String(conditions.length);
  return params;
}

export interface GeoJsonGeometry {
  type: 'Point' | 'Polygon' | 'MultiPolygon' | 'LineString' | 'MultiPoint' | 'MultiLineString';
  coordinates: unknown;
}
export interface ApiFeature {
  type: 'Feature';
  geometry: GeoJsonGeometry | null;
  /** Row columns (SELECT *) minus geometry: id / fid, name, rating, discriminator, price … — all optional/nullable. */
  properties: Record<string, unknown>;
}
export interface FeatureCollectionResponse {
  type: 'FeatureCollection';
  features: ApiFeature[];
}

export interface UniqueValuesQuery {
  layer: string;
  workspace: Workspace;
  field: string;
  /** Cascade: only values under this governorate / town. */
  gov_a?: string;
  village_a?: string;
}

export const searchApi = {
  /** POST /api/search-features-batch — several features of ONE type by id (services: `id`, real estate: `fid`). Public. */
  batch: (body: { layer: string; workspace: Workspace; ids: (number | string)[] }, signal?: AbortSignal) =>
    api.post<FeatureCollectionResponse>('/api/search-features-batch', body, { signal }),
  search: (q: SearchQuery, signal?: AbortSignal) =>
    api.get<FeatureCollectionResponse>('/api/search-features', buildSearchParams(q), { signal }),
  uniqueValues: (q: UniqueValuesQuery, signal?: AbortSignal) =>
    api.get<{ success: boolean; values: (string | number)[] }>(
      '/api/get-unique-values',
      {
        layer: q.layer,
        workspace: q.workspace,
        field: q.field,
        filter_gov_a: q.gov_a,
        filter_village_a: q.village_a,
      },
      { signal },
    ),
};
