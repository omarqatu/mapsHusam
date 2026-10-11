import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import { describe, expect, it } from 'vitest';
import { matchingRegions, regionValues, regionsExtent } from './regionPicker';

const region = (gov: string, village: string, location: string, x: number) =>
  new Feature({
    gov_a: gov,
    village_a: village,
    location,
    geometry: new Polygon([
      [
        [x, 0],
        [x + 10, 0],
        [x + 10, 10],
        [x, 10],
        [x, 0],
      ],
    ]),
  });

const regions = [
  region('رام الله', 'البيرة', 'المنارة', 10),
  region('رام الله', 'البيرة', 'الماصيون', 30),
  region('رام الله', 'بيرزيت', 'البلدة القديمة', 50),
  region('نابلس', 'نابلس', 'وسط البلد', 70),
];

describe('region picker data', () => {
  it('limits towns and localities to the selected parent regions', () => {
    expect(regionValues(regions, 'village_a', { gov_a: 'رام الله' }, 'ar')).toEqual(['البيرة', 'بيرزيت']);
    expect(regionValues(regions, 'location', { gov_a: 'رام الله', village_a: 'البيرة' }, 'en')).toEqual([
      'الماصيون',
      'المنارة',
    ]);
  });

  it('selects all matching region polygons for the map highlight', () => {
    expect(matchingRegions(regions, { gov_a: 'رام الله', village_a: 'البيرة' })).toHaveLength(2);
  });

  it('combines matching polygon extents for map navigation', () => {
    expect(regionsExtent(matchingRegions(regions, { gov_a: 'رام الله', village_a: 'البيرة' }))).toEqual([
      10, 0, 40, 10,
    ]);
    expect(regionsExtent([])).toBeNull();
  });
});
