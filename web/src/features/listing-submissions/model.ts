import { serviceLabelKey } from '@/features/map/registry';
import { targetLabelKey } from '@/features/map/targets';
import { listingTarget } from '@/features/my-listings/model';
import { toWhatsappNumber, isLocalMobile } from '@/features/auth/phone';
import { SERVICE_BY_KEY } from '@/features/map/registry';
import type { Currency } from '@/api/myListings';
import type { Coordinate } from '@/features/map/config';
import type { LandPolygon, SubmissionInput } from '@/api/listingSubmissions';

// Pure logic of the "add my business" form: values -> checks -> the request body. The server repeats every check.

/** Loose Palestine Grid bounds (metres), the same the server enforces: catches a point outside the country. */
export const GRID_X_RANGE: readonly [number, number] = [100_000, 300_000];
export const GRID_Y_RANGE: readonly [number, number] = [30_000, 300_000];

/** Ready work-hours choices (HourPresets); the free text stays for anything else. */
/** Ready work-hours choices: the stored value, and its label key (a key with ':' would read as an i18next namespace). */
export const HOUR_PRESETS = [
  { value: '00:00-23:59', key: 'allDay' },
  { value: '08:00-17:00', key: 'h8to17' },
  { value: '09:00-21:00', key: 'h9to21' },
  { value: '07:00-15:00', key: 'h7to15' },
] as const;

export const NAME_MAX = 100;
export const DES_MAX = 1000;
export const HOURS_MAX = 200;

export interface FormValues {
  layer: string;
  name: string;
  des: string;
  phone: string;
  /** Use the phone number for WhatsApp too (the usual case). */
  whatsappSame: boolean;
  workHours: string;
  price: string;
  /** Flats (and hotels / villas): area in m² and the price's currency. */
  area: string;
  currency: Currency;
}

export const EMPTY_FORM: FormValues = {
  layer: '',
  name: '',
  des: '',
  phone: '',
  whatsappSame: true,
  workHours: '',
  price: '',
  area: '',
  currency: 'USD',
};

export type FormErrors = Partial<
  Record<'layer' | 'name' | 'phone' | 'price' | 'area' | 'point', 'required' | 'invalid'>
>;

/** Flats are point locations; land sale submissions include a provider-drawn polygon. */
export const SUBMITTABLE_PROPERTY_LAYERS = ['ApartRent', 'ApartSale', 'LandSale'] as const;
export const PROPERTY_WORK_HOURS = '24 ساعة';
export const isLandLayer = (layer: string) => layer === 'LandSale';
export const isPropertyLayer = (layer: string) =>
  (SUBMITTABLE_PROPERTY_LAYERS as readonly string[]).includes(layer);

/** Properties, hotels and holiday villas are priced (with an area for properties). */
export const hasPriceField = (layer: string) =>
  isPropertyLayer(layer) || SERVICE_BY_KEY.get(layer)?.editProfile === 'propertyService';
/** Only a service has work hours. */
export const hasHoursField = (layer: string) => !isPropertyLayer(layer);

export const pointInBounds = (p: Coordinate) =>
  Number.isFinite(p[0]) &&
  Number.isFinite(p[1]) &&
  p[0] >= GRID_X_RANGE[0] &&
  p[0] <= GRID_X_RANGE[1] &&
  p[1] >= GRID_Y_RANGE[0] &&
  p[1] <= GRID_Y_RANGE[1];

function cross(o: Coordinate, a: Coordinate, b: Coordinate) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function segmentsIntersect(a: Coordinate, b: Coordinate, c: Coordinate, d: Coordinate) {
  const epsilon = 1e-8;
  const onSegment = (p: Coordinate, q: Coordinate, r: Coordinate) =>
    q[0] >= Math.min(p[0], r[0]) - epsilon &&
    q[0] <= Math.max(p[0], r[0]) + epsilon &&
    q[1] >= Math.min(p[1], r[1]) - epsilon &&
    q[1] <= Math.max(p[1], r[1]) + epsilon;
  const orientation = (value: number) => (value > epsilon ? 1 : value < -epsilon ? -1 : 0);
  const o1 = orientation(cross(a, b, c));
  const o2 = orientation(cross(a, b, d));
  const o3 = orientation(cross(c, d, a));
  const o4 = orientation(cross(c, d, b));
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  return (
    (o1 === 0 && onSegment(a, c, b)) ||
    (o2 === 0 && onSegment(a, d, b)) ||
    (o3 === 0 && onSegment(c, a, d)) ||
    (o4 === 0 && onSegment(c, b, d))
  );
}

function isValidLandPolygon(geometry: LandPolygon) {
  if (geometry.type !== 'Polygon' || geometry.coordinates.length !== 1) return false;
  const ring = geometry.coordinates[0];
  if (ring.length < 4 || ring.length > 500 || ring.some((point) => !pointInBounds(point))) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return false;
  if (
    ring
      .slice(0, -1)
      .some((point, index) => point[0] === ring[index + 1][0] && point[1] === ring[index + 1][1])
  ) {
    return false;
  }
  if (new Set(ring.slice(0, -1).map((point) => `${point[0]},${point[1]}`)).size < 3) return false;

  let twiceArea = 0;
  const segmentCount = ring.length - 1;
  for (let i = 0; i < segmentCount; i++) {
    const current = ring[i];
    const next = ring[i + 1];
    twiceArea += current[0] * next[1] - next[0] * current[1];
    for (let j = i + 1; j < segmentCount; j++) {
      if (j === i + 1 || (i === 0 && j === segmentCount - 1)) continue;
      if (segmentsIntersect(current, next, ring[j], ring[j + 1])) return false;
    }
  }
  return twiceArea !== 0;
}

export function validate(
  v: FormValues,
  point: Coordinate | null,
  geometry: LandPolygon | null = null,
): FormErrors {
  const errors: FormErrors = {};
  if (!v.layer) errors.layer = 'required';
  if (!v.name.trim()) errors.name = 'required';
  if (!v.phone.trim()) errors.phone = 'required';
  else if (!isLocalMobile(v.phone)) errors.phone = 'invalid';
  if (hasPriceField(v.layer) && v.price.trim() !== '') {
    const n = Number(v.price);
    if (!Number.isFinite(n) || n < 0) errors.price = 'invalid';
  }
  if (isPropertyLayer(v.layer) && v.area.trim() !== '') {
    const n = Number(v.area);
    if (!Number.isInteger(n) || n <= 0) errors.area = 'invalid';
  }
  if (isLandLayer(v.layer)) {
    if (!geometry) errors.point = 'required';
    else if (!isValidLandPolygon(geometry)) errors.point = 'invalid';
    else if (!point || !pointInBounds(point)) errors.point = 'invalid';
  } else if (!point) errors.point = 'required';
  else if (!pointInBounds(point)) errors.point = 'invalid';
  return errors;
}

/** The request body. Call only when `validate` found nothing. Grid metres are kept to the millimetre. */
export function toInput(
  v: FormValues,
  point: Coordinate,
  geometry: LandPolygon | null = null,
): SubmissionInput {
  const phone = v.phone.trim();
  const input: SubmissionInput = {
    layer: v.layer,
    name: v.name.trim(),
    phone,
    x_coord: Number(point[0].toFixed(3)),
    y_coord: Number(point[1].toFixed(3)),
  };
  if (v.des.trim()) input.des = v.des.trim();
  if (isPropertyLayer(v.layer)) input.work_hours = PROPERTY_WORK_HOURS;
  else if (hasHoursField(v.layer) && v.workHours.trim()) input.work_hours = v.workHours.trim();
  if (v.whatsappSame) input.whatsapp = toWhatsappNumber('970', phone);
  if (hasPriceField(v.layer) && v.price.trim() !== '') input.price = Number(v.price);
  if (isPropertyLayer(v.layer)) {
    input.currency = v.currency;
    if (v.area.trim() !== '') input.area = Number(v.area);
  }
  if (isLandLayer(v.layer) && geometry) input.geometry = geometry;
  return input;
}

/** The type's name for a submission (a service or a flat). */
export function submissionTypeKey(layer: string) {
  const target = listingTarget(layer);
  return target ? targetLabelKey(target) : serviceLabelKey(layer);
}
