import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, filterFields, toConditions } from '@/features/search/filters';
import { priceLabel } from './popup/featureModel';
import { fieldsFor } from './search/model';
import { hasPrice, priceCurrencyDefault, targetFromKey } from './targets';

const t = (key: string) => ({ 'popup.currency.USD': '$', 'popup.currency.ILS': '₪' })[key] ?? key;
const target = (key: string) => targetFromKey(key)!;

describe('hotels and holiday villas are priced like property', () => {
  it('property, hotels and villas have a price; other services do not', () => {
    for (const k of ['rent', 'sale', 'land', 'hotels', 'villas_rent']) expect(hasPrice(target(k)), k).toBe(true);
    for (const k of ['plumber', 'road_barriers', 'fuel_stations']) expect(hasPrice(target(k)), k).toBe(false);
    expect(hasPrice(null)).toBe(false);
    expect(hasPrice({ kind: 'location' })).toBe(false);
  });

  it("a service's price is dollars; a property's currency comes from its row", () => {
    expect(priceCurrencyDefault(target('hotels'))).toBe('USD');
    expect(priceCurrencyDefault(target('rent'))).toBeUndefined();
    expect(priceLabel({ price: 1500 }, t, 'en', 'USD')).toBe('1,500 $');
    expect(priceLabel({ price: 1500, currency: 'ILS' }, t, 'en', 'USD')).toBe('1,500 ₪');
    expect(priceLabel({ price: 1500 }, t, 'en')).toBe('1,500');
    expect(priceLabel({ price: 0 }, t, 'en', 'USD')).toBeNull();
  });

  it('the search offers price (in dollars) and area for hotels and villas, not for other services', () => {
    for (const k of ['hotels', 'villas_rent']) {
      const fields = fieldsFor(target(k));
      expect(fields.map((f) => f.id)).toEqual(['gov_a', 'village_a', 'location_name', 'name', 'price', 'area']);
      expect(fields.find((f) => f.id === 'price')).toMatchObject({ type: 'number', labelKey: 'search.fields.priceUsd' });
    }
    expect(fieldsFor(target('plumber')).map((f) => f.id)).not.toContain('price');
    expect(fieldsFor(target('rent')).find((f) => f.id === 'price')?.labelKey).toBe('search.fields.price');
  });

  it('a price filter on a hotel is a plain condition (no currency condition is added)', () => {
    const fields = filterFields(target('hotels'));
    const conditions = toConditions(
      { ...EMPTY_FILTERS, values: { price: { value: '200', operator: '<' }, area: { value: '80', operator: '>' } } },
      fields,
    );
    expect(conditions).toEqual([
      { field: 'price', operator: '<', value: '200' },
      { field: 'area', operator: '>', value: '80' },
    ]);
  });
});
