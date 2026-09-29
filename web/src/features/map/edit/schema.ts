// What the admin editor may write, per layer — data only, ported from the legacy field lists in js/edit-core.js,
// js/edit-wfs.js, js/editLines.js and js/editPolygons.js. Field labels live in the locale files (edit.fields.<name>).
import { SERVICE_TYPES } from '../config';

export type EditKind = 'point' | 'line' | 'polygon';
export type FieldType = 'text' | 'number' | 'integer' | 'url' | 'date' | 'select' | 'hours';

export interface FieldDef {
  name: string;
  type: FieldType;
  /** `select` only: the allowed values; the labels are `edit.options.<name>.<value>`. First value is the default. */
  options?: readonly string[];
  /** Latin digits / links: the input is always left-to-right. */
  ltr?: boolean;
  /** `number` only: inclusive upper bound of a rating. */
  max?: number;
}

export type StoredGeometry = 'Point' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';

/** Which coordinate columns a point layer keeps in sync with its geometry. */
export type CoordColumns = 'realEstate' | 'service' | 'none';

export interface EditTarget {
  /** `rent`, `sale`, `land`, `locations`, `roads` or a service `discriminator`. */
  id: string;
  kind: EditKind;
  workspace: 'realestate' | 'services';
  /** GeoServer feature type (whitelisted by the server). */
  typeName: string;
  /** `key` of the map layer that shows / loads it (`rent`, `sale`, `land`, `services`, or the edit-only `roads` / `locations`). */
  layerKey: string;
  /** Set for services: written to the row as `discriminator`. */
  discriminator?: string;
  /** Geometry type the table stores (a drawn LineString is wrapped into a MultiLineString, etc.). */
  geometry: StoredGeometry;
  fields: readonly FieldDef[];
  /** Column order of an insert (GeoServer schema order), `geom` included. */
  insertColumns: readonly string[];
  /** Columns an update may write besides geometry and the coordinate columns. */
  updateColumns: readonly string[];
  coordColumns: CoordColumns;
}

const CURRENCIES = ['USD', 'ILS', 'JOD'] as const;
const BARRIER_STATES = ['0', '1', '2', '3', '4'] as const;
const FUEL_STATES = ['0', '1'] as const;

const f = (name: string, type: FieldType, extra: Partial<FieldDef> = {}): FieldDef => ({
  name,
  type,
  ...extra,
});

const REAL_ESTATE_FIELDS: readonly FieldDef[] = [
  f('name', 'text'),
  f('price', 'number'),
  f('currency', 'select', { options: CURRENCIES }),
  f('des', 'text'),
  f('pic', 'url', { ltr: true }),
  f('video', 'url', { ltr: true }),
  f('area', 'number'),
  f('whatsapp', 'text', { ltr: true }),
  f('phone', 'text', { ltr: true }),
  f('end_date', 'date'),
  f('work_hours', 'hours'),
  f('rating', 'number', { max: 10 }),
];

const SERVICE_FIELDS: readonly FieldDef[] = [
  f('name', 'text'),
  f('whatsapp', 'text', { ltr: true }),
  f('phone', 'text', { ltr: true }),
  f('des', 'text'),
  f('pic', 'url', { ltr: true }),
  f('video', 'url', { ltr: true }),
  f('rating', 'number', { max: 10 }),
  f('details_link_1', 'url', { ltr: true }),
  f('details_link_2', 'url', { ltr: true }),
  f('end_date', 'date'),
  f('work_hours', 'hours'),
];

const LAND_FIELDS: readonly FieldDef[] = [
  f('name', 'text'),
  f('phone', 'text', { ltr: true }),
  f('price', 'number'),
  f('currency', 'select', { options: CURRENCIES }),
  f('des', 'text'),
  f('pic', 'url', { ltr: true }),
  f('video', 'url', { ltr: true }),
  f('area', 'number'),
  f('whatsapp', 'text', { ltr: true }),
  f('end_date', 'date'),
  f('work_hours', 'hours'),
  f('rating', 'number', { max: 5 }),
];

const LOCATION_FIELDS: readonly FieldDef[] = [f('gov_a', 'text'), f('village_a', 'text'), f('location', 'text')];

const ROAD_FIELDS: readonly FieldDef[] = [f('name', 'text'), f('road_type', 'integer'), f('one_way', 'integer')];

// Column order = the GeoServer schema order the legacy editor insisted on. Real-estate `phone` was missing from the
// legacy insert list (typed, then silently dropped); it is appended here.
const REAL_ESTATE_INSERT = [
  'geom', 'location', 'name', 'price', 'currency', 'des', 'pic', 'video', 'area',
  'x_coord', 'y_coord', 'status', 'gov_a', 'village_a', 'X', 'Y', 'start_date', 'end_date', 'work_hours',
  'auto_status', 'whatsapp', 'search_tags', 'rating', 'phone',
] as const;
const REAL_ESTATE_UPDATE = [
  'name', 'price', 'currency', 'des', 'pic', 'video', 'area', 'end_date', 'work_hours', 'whatsapp', 'phone',
  'rating', 'location', 'search_tags',
] as const;

const SERVICE_INSERT = [
  'geom', 'discriminator', 'name', 'whatsapp', 'phone', 'des', 'pic', 'video', 'rating', 'details_link_1',
  'details_link_2', 'end_date', 'work_hours', 'location_name', 'x_coord', 'y_coord', 'x_global', 'y_global',
  'status', 'gov_a', 'village_a', 'start_date', 'auto_status', 'search_tags',
] as const;
const SERVICE_UPDATE = [
  'name', 'whatsapp', 'phone', 'pic', 'video', 'rating', 'details_link_1', 'details_link_2', 'end_date',
  'work_hours', 'des', 'search_tags',
] as const;

const LAND_INSERT = [
  'geom', 'location', 'name', 'phone', 'price', 'currency', 'des', 'pic', 'video', 'area', 'status', 'gov_a',
  'village_a', 'start_date', 'end_date', 'work_hours', 'auto_status', 'whatsapp', 'search_tags', 'rating',
] as const;
const LAND_UPDATE = [
  'name', 'phone', 'price', 'currency', 'des', 'pic', 'video', 'area', 'end_date', 'work_hours', 'whatsapp',
  'rating', 'search_tags',
] as const;

const realEstate = (id: 'rent' | 'sale', typeName: string): EditTarget => ({
  id,
  kind: 'point',
  workspace: 'realestate',
  typeName,
  layerKey: id,
  geometry: 'Point',
  fields: REAL_ESTATE_FIELDS,
  insertColumns: REAL_ESTATE_INSERT,
  updateColumns: REAL_ESTATE_UPDATE,
  coordColumns: 'realEstate',
});

/** Road barriers and fuel stations carry extra status columns on top of the common service fields. */
const SERVICE_EXTRAS: Readonly<Record<string, readonly FieldDef[]>> = {
  road_barriers: [f('stop', 'select', { options: BARRIER_STATES }), f('stop2', 'select', { options: BARRIER_STATES })],
  fuel_stations: [
    f('diesel', 'select', { options: FUEL_STATES }),
    f('banzen95', 'select', { options: FUEL_STATES }),
    f('banzen98', 'select', { options: FUEL_STATES }),
  ],
};

export function serviceTarget(discriminator: string): EditTarget {
  const extras = SERVICE_EXTRAS[discriminator] ?? [];
  const extraColumns = extras.map((x) => x.name);
  return {
    id: discriminator,
    kind: 'point',
    workspace: 'services',
    typeName: 'service_all',
    layerKey: 'services',
    discriminator,
    geometry: 'Point',
    fields: [...SERVICE_FIELDS, ...extras],
    insertColumns: [...SERVICE_INSERT, ...extraColumns],
    updateColumns: [...SERVICE_UPDATE, ...extraColumns],
    coordColumns: 'service',
  };
}

const LAND: EditTarget = {
  id: 'land',
  kind: 'polygon',
  workspace: 'realestate',
  typeName: 'LandSale',
  layerKey: 'land',
  geometry: 'Polygon',
  fields: LAND_FIELDS,
  insertColumns: LAND_INSERT,
  updateColumns: LAND_UPDATE,
  coordColumns: 'none',
};

const LOCATIONS: EditTarget = {
  id: 'locations',
  kind: 'polygon',
  workspace: 'realestate',
  typeName: 'Location',
  layerKey: 'locations',
  geometry: 'MultiPolygon',
  fields: LOCATION_FIELDS,
  insertColumns: ['geom', 'gov_a', 'village_a', 'location'],
  updateColumns: ['gov_a', 'village_a', 'location'],
  coordColumns: 'none',
};

const ROADS: EditTarget = {
  id: 'roads',
  kind: 'line',
  workspace: 'realestate',
  typeName: 'RoadsTest',
  layerKey: 'roads',
  geometry: 'MultiLineString',
  fields: ROAD_FIELDS,
  insertColumns: ['geom', 'name', 'road_type', 'village_a', 'one_way', 'source', 'target', 'cost', 'gov_a'],
  updateColumns: ['name', 'road_type', 'one_way', 'source', 'target', 'cost', 'gov_a', 'village_a'],
  coordColumns: 'none',
};

export const POINT_TARGETS: readonly EditTarget[] = [
  realEstate('rent', 'ApartRent'),
  realEstate('sale', 'ApartSale'),
  ...SERVICE_TYPES.map((s) => serviceTarget(s.key)),
];
export const LINE_TARGETS: readonly EditTarget[] = [ROADS];
export const POLYGON_TARGETS: readonly EditTarget[] = [LAND, LOCATIONS];

export const EDIT_TARGETS: readonly EditTarget[] = [...POINT_TARGETS, ...LINE_TARGETS, ...POLYGON_TARGETS];

export const targetsOfKind = (kind: EditKind) => EDIT_TARGETS.filter((t) => t.kind === kind);
export const editTargetById = (kind: EditKind, id: string) =>
  EDIT_TARGETS.find((t) => t.kind === kind && t.id === id) ?? null;

/** Layers that exist only for editing (the map never shows them): loaded while their tab is open. */
export const EDIT_ONLY_LAYERS = {
  roads: { workspace: 'realestate', typeName: 'RoadsTest', maxResolution: 3, zIndex: 15 },
  locations: { workspace: 'realestate', typeName: 'Location', maxResolution: 40, zIndex: 5 },
} as const;
