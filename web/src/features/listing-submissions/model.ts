import { toWhatsappNumber, isLocalMobile } from '@/features/auth/phone';
import { SERVICE_BY_KEY } from '@/features/map/registry';
import type { Currency } from '@/api/myListings';
import type { Coordinate } from '@/features/map/config';
import type { SubmissionInput } from '@/api/listingSubmissions';

// Pure logic of the "add my business" form: values -> checks -> the request body. The server repeats every check.

/** Loose Palestine Grid bounds (metres), the same the server enforces: catches a point outside the country. */
export const GRID_X_RANGE: readonly [number, number] = [100_000, 300_000];
export const GRID_Y_RANGE: readonly [number, number] = [30_000, 300_000];

/** Ready work-hours choices (HourPresets); the free text stays for anything else. */
export const HOUR_PRESETS = ['00:00-23:59', '08:00-17:00', '09:00-21:00', '07:00-15:00'] as const;

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

/** The property layers a provider may submit (a flat is a point; a plot is drawn by the admins). */
export const SUBMITTABLE_PROPERTY_LAYERS = ['ApartRent', 'ApartSale'] as const;
export const isPropertyLayer = (layer: string) => (SUBMITTABLE_PROPERTY_LAYERS as readonly string[]).includes(layer);

/** Flats, hotels and holiday villas are priced (with an area); every other type has no price field. */
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

export function validate(v: FormValues, point: Coordinate | null): FormErrors {
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
  if (!point) errors.point = 'required';
  else if (!pointInBounds(point)) errors.point = 'invalid';
  return errors;
}

/** The request body. Call only when `validate` found nothing. Grid metres are kept to the millimetre. */
export function toInput(v: FormValues, point: Coordinate): SubmissionInput {
  const phone = v.phone.trim();
  const input: SubmissionInput = {
    layer: v.layer,
    name: v.name.trim(),
    phone,
    x_coord: Number(point[0].toFixed(3)),
    y_coord: Number(point[1].toFixed(3)),
  };
  if (v.des.trim()) input.des = v.des.trim();
  if (hasHoursField(v.layer) && v.workHours.trim()) input.work_hours = v.workHours.trim();
  if (v.whatsappSame) input.whatsapp = toWhatsappNumber('970', phone);
  if (hasPriceField(v.layer) && v.price.trim() !== '') input.price = Number(v.price);
  if (isPropertyLayer(v.layer)) {
    input.currency = v.currency;
    if (v.area.trim() !== '') input.area = Number(v.area);
  }
  return input;
}
