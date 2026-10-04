import { describe, expect, it } from 'vitest';
import {
  EMPTY_FORM,
  hasHoursField,
  hasPriceField,
  isPropertyLayer,
  pointInBounds,
  toInput,
  validate,
  type FormValues,
} from './model';

const ok: FormValues = { ...EMPTY_FORM, layer: 'plumber', name: ' سباكة الأمل ', phone: '0591234567' };
const point: [number, number] = [169463.41234, 145767.99876];

describe('listing submission form', () => {
  it('accepts a complete form', () => {
    expect(validate(ok, point)).toEqual({});
  });

  it('asks for the type, name, phone and location', () => {
    expect(validate(EMPTY_FORM, null)).toEqual({
      layer: 'required',
      name: 'required',
      phone: 'required',
      point: 'required',
    });
  });

  it('rejects a non-mobile phone and a point outside the grid', () => {
    expect(validate({ ...ok, phone: '021234567' }, point).phone).toBe('invalid');
    expect(validate(ok, [1, 2]).point).toBe('invalid');
    expect(pointInBounds([169463, 145767])).toBe(true);
    expect(pointInBounds([Number.NaN, 145767])).toBe(false);
  });

  it('only hotels and villas take a price', () => {
    expect(hasPriceField('hotels')).toBe(true);
    expect(hasPriceField('villas_rent')).toBe(true);
    expect(hasPriceField('plumber')).toBe(false);
    expect(validate({ ...ok, layer: 'hotels', price: '-5' }, point).price).toBe('invalid');
    expect(validate({ ...ok, layer: 'plumber', price: '-5' }, point).price).toBeUndefined();
  });

  it('builds a clean body', () => {
    expect(toInput(ok, point)).toEqual({
      layer: 'plumber',
      name: 'سباكة الأمل',
      phone: '0591234567',
      whatsapp: '+970591234567',
      x_coord: 169463.412,
      y_coord: 145767.999,
    });
    const body = toInput(
      { ...ok, layer: 'hotels', whatsappSame: false, price: '80', des: ' غرف ', workHours: '24' },
      point,
    );
    expect(body).toMatchObject({ price: 80, des: 'غرف', work_hours: '24' });
    expect(body.whatsapp).toBeUndefined();
    expect(toInput({ ...ok, price: '80' }, point).price).toBeUndefined();
  });

  it('a flat takes a price, a currency and an area, and no hours', () => {
    expect(isPropertyLayer('ApartRent')).toBe(true);
    expect(isPropertyLayer('LandSale')).toBe(false);
    expect(hasHoursField('ApartSale')).toBe(false);
    const flat = {
      ...ok,
      layer: 'ApartRent',
      price: '400',
      currency: 'ILS' as const,
      area: '120',
      workHours: '24',
    };
    expect(validate({ ...flat, area: '0' }, point).area).toBe('invalid');
    expect(validate({ ...ok, area: '0' }, point).area).toBeUndefined();
    const body = toInput(flat, point);
    expect(body).toMatchObject({ layer: 'ApartRent', price: 400, currency: 'ILS', area: 120 });
    expect(body.work_hours).toBeUndefined();
  });
});
