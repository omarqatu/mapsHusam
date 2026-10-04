import type { Currency, ListingEdit, ListingState, MyListing } from '@/api/myListings';
import { isLocalMobile, toWhatsappNumber } from '@/features/auth/phone';
import { REAL_ESTATE_LAYERS } from '@/features/map/config';
import { hasPrice, targetFromKey, type MapTarget } from '@/features/map/targets';

// Pure logic of "My listings": which form fields a listing has, the form ↔ the edit body. The server repeats every check.

export const LISTING_STATES: readonly ListingState[] = [0, 1, 2];
export const CURRENCIES: readonly Currency[] = ['ILS', 'USD', 'JOD'];

/** The map type of a listing (`plumber`, `ApartRent`, …): its icon and its name. */
export function listingTarget(layer: string): MapTarget | null {
  const property = REAL_ESTATE_LAYERS.find((l) => l.typeName === layer);
  return property ? { kind: 'realEstate', layer: property.key } : targetFromKey(layer);
}

export interface ListingFormValues {
  name: string;
  des: string;
  phone: string;
  whatsapp: string;
  workHours: string;
  price: string;
  currency: Currency;
  area: string;
}

export const toFormValues = (l: MyListing): ListingFormValues => ({
  name: l.name,
  des: l.des,
  phone: l.phone,
  // `+970591234567` → `0591234567`: the form speaks local numbers
  whatsapp: /^\+970\d{9}$/.test(l.whatsapp) ? `0${l.whatsapp.slice(4)}` : l.whatsapp,
  workHours: l.work_hours,
  price: l.price === null ? '' : String(l.price),
  currency: l.currency ?? 'USD',
  area: l.area === null ? '' : String(l.area),
});

/** What the form shows for this listing. */
export function listingFields(l: Pick<MyListing, 'kind' | 'layer'>) {
  const priced = hasPrice(listingTarget(l.layer));
  return { hours: l.kind === 'service', price: priced, area: priced, move: l.kind === 'service' };
}

export type ListingFormErrors = Partial<
  Record<'name' | 'phone' | 'whatsapp' | 'price' | 'area', 'required' | 'invalid'>
>;

export function validateListing(
  v: ListingFormValues,
  l: Pick<MyListing, 'kind' | 'layer'>,
): ListingFormErrors {
  const f = listingFields(l);
  const e: ListingFormErrors = {};
  if (!v.name.trim()) e.name = 'required';
  if (!v.phone.trim()) e.phone = 'required';
  else if (!isLocalMobile(v.phone)) e.phone = 'invalid';
  if (v.whatsapp.trim() && !isLocalMobile(v.whatsapp) && !/^\+?\d{11,15}$/.test(v.whatsapp.trim()))
    e.whatsapp = 'invalid';
  if (f.price && v.price.trim() && !(Number(v.price) >= 0)) e.price = 'invalid';
  if (f.area && v.area.trim() && !(Number.isInteger(Number(v.area)) && Number(v.area) > 0))
    e.area = 'invalid';
  return e;
}

const whatsappOut = (v: string) => {
  const s = v.trim();
  if (!s) return '';
  return isLocalMobile(s) ? toWhatsappNumber('970', s) : s;
};

/** Only what changed, as the server takes it. Call when `validateListing` found nothing. */
export function toEdit(v: ListingFormValues, l: MyListing): ListingEdit {
  const f = listingFields(l);
  const was = toFormValues(l);
  const out: ListingEdit = {};
  if (v.name.trim() !== was.name) out.name = v.name.trim();
  if (v.des.trim() !== was.des) out.des = v.des.trim();
  if (v.phone.trim() !== was.phone) out.phone = v.phone.trim();
  if (v.whatsapp.trim() !== was.whatsapp) out.whatsapp = whatsappOut(v.whatsapp);
  if (f.hours && v.workHours.trim() !== was.workHours) out.work_hours = v.workHours.trim();
  if (f.price && v.price.trim() !== was.price) out.price = v.price.trim() === '' ? null : Number(v.price);
  if (f.price && v.currency !== was.currency) out.currency = v.currency;
  if (f.area && v.area.trim() !== was.area) out.area = v.area.trim() === '' ? null : Number(v.area);
  return out;
}

