import {
  ALWAYS_OPEN,
  INSERT_DEFAULTS,
  buildSearchTags,
  parseValues,
  type FormValues,
  type Props,
} from './attributes';
import { round, validateGeometry, type GeometryData, type GeometryError, type Position } from './geometry';
import { toLonLat } from '../projection';
import { NO_REGION, type Regional } from './regional';
import type { EditTarget } from './schema';
import { featureFid, type FeatureTx } from './tx';

/** Keys of `edit.errors.*`. */
export type BuildError = GeometryError | 'noFid' | 'noGeometry';

export type BuildResult = { ok: true; tx: FeatureTx } | { ok: false; error: BuildError };

export interface BuildInput {
  op: FeatureTx['op'];
  target: EditTarget;
  /** The feature's id as OpenLayers / GeoServer gave it (`ApartRent.12`). Update and delete. */
  featureId?: string | number | null;
  /** Insert and update. */
  geometry?: GeometryData;
  /** Insert and update: what the attribute dialog holds. */
  values?: FormValues;
  /** Insert (and update of roads): the region under the feature. */
  regional?: Regional;
  /** `YYYY-MM-DD` of today; a parameter so tests do not depend on the clock. */
  today?: string;
}

/** Columns kept in sync with a point: grid metres to 2 dp, WGS84 degrees to 6 dp (legacy). */
export function coordinateColumns(target: EditTarget, position: Position): Props {
  if (target.coordColumns === 'none') return {};
  const [lon, lat] = toLonLat(position);
  const out: Props = { x_coord: round(position[0], 2), y_coord: round(position[1], 2) };
  if (target.coordColumns === 'realEstate') {
    out.X = round(lon, 6);
    out.Y = round(lat, 6);
  } else {
    out.x_global = round(lon, 6);
    out.y_global = round(lat, 6);
  }
  return out;
}

const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

/** Fields an update may empty. The name and the rating are never blanked (a nameless / unrated row breaks lists). */
const KEEP_WHEN_EMPTY = new Set(['name', 'rating']);

export function buildFeatureTx(input: BuildInput): BuildResult {
  const { op, target } = input;
  const layer = { workspace: target.workspace, typeName: target.typeName };

  if (op === 'delete') {
    const fid = featureFid(target.typeName, input.featureId);
    return fid ? { ok: true, tx: { op, layer, fid, properties: {} } } : { ok: false, error: 'noFid' };
  }

  const geometry = input.geometry;
  if (!geometry) return { ok: false, error: 'noGeometry' };
  const geometryError = validateGeometry(geometry);
  if (geometryError) return { ok: false, error: geometryError };

  const form = parseValues(target, input.values ?? {});
  const regional = input.regional ?? NO_REGION;
  const point: Position | null = geometry.type === 'Point' ? geometry.coordinates : null;

  if (op === 'update') {
    const fid = featureFid(target.typeName, input.featureId);
    if (!fid) return { ok: false, error: 'noFid' };
    const properties: Props = {};
    for (const column of target.updateColumns) {
      if (!(column in form)) continue;
      const v = form[column];
      if (!isEmpty(v)) properties[column] = v;
      else if (!KEEP_WHEN_EMPTY.has(column)) properties[column] = null;
    }
    const tags = buildSearchTags(target, form);
    if (tags !== null && target.updateColumns.includes('search_tags')) properties.search_tags = tags;
    // Roads keep the region of their first vertex up to date (legacy); a miss leaves the stored region alone.
    if (target.id === 'roads' && regional.found) {
      properties.gov_a = regional.gov_a;
      properties.village_a = regional.village_a;
    }
    if (point) Object.assign(properties, coordinateColumns(target, point));
    return { ok: true, tx: { op, layer, fid, properties, geometry } };
  }

  // insert
  const properties: Props = { ...form };
  const isPoint = target.kind === 'point';
  const withRegion = isPoint || target.id === 'land' || target.id === 'roads';

  if (isPoint && isEmpty(properties.name)) properties.name = INSERT_DEFAULTS.name;
  if (target.id === 'roads' && isEmpty(properties.name)) properties.name = INSERT_DEFAULTS.roadName;
  if ('rating' in form && isEmpty(properties.rating)) properties.rating = INSERT_DEFAULTS.rating;
  if ('price' in form && isEmpty(properties.price)) properties.price = 0;
  if ('area' in form && isEmpty(properties.area)) properties.area = 0;
  if ('currency' in form && isEmpty(properties.currency)) properties.currency = INSERT_DEFAULTS.currency;
  if (isPoint && 'work_hours' in form && isEmpty(properties.work_hours)) properties.work_hours = ALWAYS_OPEN;

  if (withRegion) {
    properties.gov_a = regional.gov_a;
    properties.village_a = regional.village_a;
    if (target.id === 'land' || target.id === 'rent' || target.id === 'sale') properties.location = regional.location;
    if (target.workspace === 'services') properties.location_name = regional.location;
  } else {
    // A new region: what the admin typed, else "not specified".
    for (const c of ['gov_a', 'village_a', 'location'])
      if (isEmpty(properties[c])) properties[c] = INSERT_DEFAULTS.place;
  }

  if (target.id === 'roads') Object.assign(properties, { source: 0, target: 0, cost: 0 });
  if (target.discriminator) properties.discriminator = target.discriminator;
  if (isPoint || target.id === 'land') {
    Object.assign(properties, { status: 0, auto_status: 0, start_date: input.today ?? todayIso() });
  }
  const tags = buildSearchTags(target, properties);
  if (tags !== null) properties.search_tags = tags;
  if (point) Object.assign(properties, coordinateColumns(target, point));

  return { ok: true, tx: { op, layer, columns: target.insertColumns, properties, geometry } };
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
