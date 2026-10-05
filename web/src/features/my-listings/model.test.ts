import { describe, expect, it } from 'vitest';
import type { MyListing } from '@/api/myListings';
import { listingFields, listingTarget, toEdit, toFormValues, validateListing } from './model';

const plumber: MyListing = {
  layer: 'plumber',
  id: 14,
  kind: 'service',
  name: 'سباكة الأمل',
  des: '',
  phone: '0591234567',
  whatsapp: '+970591234567',
  work_hours: '08:00-17:00',
  price: null,
  currency: null,
  area: null,
  location: 'رام الله',
  status: 0,
  auto_status: 0,
  end_date: null,
  photos: [],
  before: null,
  after: null,
  media_default: 'photos',
  x: 169463,
  y: 145767,
  rating_avg: null,
  rating_count: 0,
};
const flat: MyListing = {
  ...plumber,
  layer: 'ApartRent',
  id: 7,
  kind: 'property',
  work_hours: '',
  price: 400,
  currency: 'USD',
  area: 120,
};

describe('my listings model', () => {
  it('knows the type of a service and of a property', () => {
    expect(listingTarget('plumber')).not.toBeNull();
    expect(listingTarget('ApartRent')).toMatchObject({ kind: 'realEstate' });
    expect(listingTarget('nonsense')).toBeNull();
  });

  it('a service has hours and moves; a flat has price and area and stays put', () => {
    expect(listingFields(plumber)).toEqual({ hours: true, price: false, area: false, move: true });
    expect(listingFields(flat)).toEqual({ hours: false, price: true, area: true, move: false });
  });

  it('shows the WhatsApp number as a local one', () => {
    expect(toFormValues(plumber).whatsapp).toBe('0591234567');
    expect(toFormValues(flat)).toMatchObject({ price: '400', currency: 'USD', area: '120' });
  });

  it('checks the name, the phone, the price and the area', () => {
    const v = toFormValues(flat);
    expect(validateListing(v, flat)).toEqual({});
    expect(validateListing({ ...v, name: ' ', phone: '021234567', price: '-1', area: '12.5' }, flat)).toEqual(
      {
        name: 'required',
        phone: 'invalid',
        price: 'invalid',
        area: 'invalid',
      },
    );
    // a service has no price field, so a stray value is not an error
    expect(validateListing({ ...toFormValues(plumber), price: '-1' }, plumber)).toEqual({});
  });

  it('sends only what changed', () => {
    expect(toEdit(toFormValues(plumber), plumber)).toEqual({});
    expect(
      toEdit({ ...toFormValues(plumber), name: ' سباكة النور ', whatsapp: '0597654321' }, plumber),
    ).toEqual({
      name: 'سباكة النور',
      whatsapp: '+970597654321',
    });
    expect(toEdit({ ...toFormValues(flat), price: '', currency: 'ILS', workHours: 'x' }, flat)).toEqual({
      price: null,
      currency: 'ILS',
    });
  });
});
