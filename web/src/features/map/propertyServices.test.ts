import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, filterFields, toConditions } from '@/features/search/filters';
import { currencyCode, priceLabel } from './popup/featureModel';
import { fieldsFor } from './search/model';
import { hasPrice, priceCurrencyDefault, targetFromKey } from './targets';

const t = (key: string) =>
  ({ 'popup.currency.USD': '$', 'popup.currency.ILS': '₪', 'popup.currency.JOD': 'JD' })[key] ?? key;
const target = (key: string) => targetFromKey(key)!;

describe('hotels and holiday villas are priced like property', () => {
  it('property, hotels and villas have a price; other services do not', () => {
    for (const k of ['rent', 'sale', 'land', 'hotels', 'villas_rent'])
      expect(hasPrice(target(k)), k).toBe(true);
    for (const k of ['plumber', 'road_barriers', 'fuel_stations']) expect(hasPrice(target(k)), k).toBe(false);
    expect(hasPrice(null)).toBe(false);
    expect(hasPrice({ kind: 'location' })).toBe(false);
  });

  it("the row's currency wins; a hotel saved without one is in dollars", () => {
    expect(priceCurrencyDefault(target('hotels'))).toBe('USD');
    expect(priceCurrencyDefault(target('rent'))).toBeUndefined();
    expect(priceLabel({ price: 1500 }, t, 'en', 'USD')).toBe('1,500 $');
    expect(priceLabel({ price: 1500, currency: 'ILS' }, t, 'en', 'USD')).toBe('1,500 ₪');
    expect(priceLabel({ price: 1500, currency: 'unknown' }, t, 'en', 'USD')).toBe('1,500 unknown');
    expect(priceLabel({ price: 1500 }, t, 'en')).toBe('1,500');
    expect(priceLabel({ price: 0 }, t, 'en', 'USD')).toBeNull();
  });

  it('reads the currency spellings found in rows (codes, symbols, Arabic names)', () => {
    expect(['usd', '$', 'دولار'].map(currencyCode)).toEqual(['USD', 'USD', 'USD']);
    expect(['ILS', '₪', 'شيكل', 'شيقل'].map(currencyCode)).toEqual(['ILS', 'ILS', 'ILS', 'ILS']);
    expect(['jod', 'د.أ', 'دينار'].map(currencyCode)).toEqual(['JOD', 'JOD', 'JOD']);
    expect([null, '', 'EUR'].map(currencyCode)).toEqual([null, null, null]);
    expect(priceLabel({ price: 90, currency: 'شيقل' }, t, 'en', 'USD')).toBe('90 ₪');
  });

  it('the search offers price and area for hotels and villas, not for other services', () => {
    for (const k of ['hotels', 'villas_rent']) {
      const fields = fieldsFor(target(k));
      expect(fields.map((f) => f.id)).toEqual([
        'gov_a',
        'village_a',
        'location_name',
        'name',
        'price',
        'area',
      ]);
      expect(fields.find((f) => f.id === 'price')).toMatchObject({
        type: 'number',
        labelKey: 'search.fields.price',
      });
    }
    expect(fieldsFor(target('plumber')).map((f) => f.id)).not.toContain('price');
    expect(fieldsFor(target('rent')).find((f) => f.id === 'price')?.labelKey).toBe('search.fields.price');
  });

  it('a price filter on a hotel adds the chosen currency, like property', () => {
    const fields = filterFields(target('hotels'));
    const values = {
      price: { value: '200', operator: '<' as const },
      area: { value: '80', operator: '>' as const },
    };
    expect(toConditions({ ...EMPTY_FILTERS, values }, fields)).toEqual([
      { field: 'price', operator: '<', value: '200' },
      { field: 'area', operator: '>', value: '80' },
    ]);
    expect(toConditions({ values, currency: 'ILS' }, fields)).toContainEqual({
      field: 'currency',
      operator: '=',
      value: 'ILS',
    });
  });
});
