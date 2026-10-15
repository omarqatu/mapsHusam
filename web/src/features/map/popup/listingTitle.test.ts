import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { listingTitle } from './featureModel';

// A card's title: its name, else its place name, else what it is and where — never a bare section name.

const t = i18n.getFixedT('ar');

describe('listingTitle', () => {
  it('uses the name, then the place name', () => {
    expect(
      listingTitle(
        { kind: 'service', discriminator: 'plumber' },
        { name: 'أبو أحمد', location_name: 'X' },
        t,
      ),
    ).toBe('أبو أحمد');
    expect(listingTitle({ kind: 'realEstate', layer: 'rent' }, { location_name: 'عمارة النور' }, t)).toBe(
      'عمارة النور',
    );
  });

  it('says what a nameless property is and where', () => {
    expect(
      listingTitle({ kind: 'realEstate', layer: 'rent' }, { village_a: 'بيتونيا', gov_a: 'رام الله' }, t),
    ).toBe('شقة للإيجار في بيتونيا');
    expect(listingTitle({ kind: 'realEstate', layer: 'land' }, { gov_a: 'أريحا' }, t)).toBe(
      'أرض للبيع في أريحا',
    );
    expect(listingTitle({ kind: 'realEstate', layer: 'sale' }, {}, t)).toBe('شقة للبيع');
  });

  it('a nameless service falls back to its type', () => {
    expect(listingTitle({ kind: 'service', discriminator: 'plumber' }, { village_a: 'البيرة' }, t)).toMatch(
      / في البيرة$/,
    );
  });
});
