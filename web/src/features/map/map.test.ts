import { describe, expect, it, beforeEach } from 'vitest';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import { wfsUrls } from '@/api/geoserver';
import { roadBarrierStatus, SERVICE_TYPES } from './config';
import { formatGrid, formatLatLon, geolocationErrorKey, readSharedCenter } from './mapUtils';
import { fromLonLat, toLonLat } from './projection';
import { useMapUi } from './store';
import { formatLabel, realEstateStyle, serviceStyle } from './styles';

const t = (k: string) => (k === 'map.areaUnit' ? 'م²' : `[${k}]`);
const svc = (props: Record<string, unknown>) => new Feature({ geometry: new Point([0, 0]), ...props });
const labelOf = (s: ReturnType<ReturnType<typeof serviceStyle>>) => s?.getText()?.getText();

describe('service style (service_all, by discriminator)', () => {
  const style = serviceStyle({ t, isHidden: (d) => d === 'plumber' });

  it('draws nothing for unknown / missing / hidden types', () => {
    expect(style(svc({ discriminator: 'nope' }), 0.1)).toBeUndefined();
    expect(style(svc({}), 0.1)).toBeUndefined();
    expect(style(svc({ discriminator: 'plumber' }), 0.1)).toBeUndefined();
  });

  it('applies the legacy visibility tiers', () => {
    // ordinary service: only when close (res <= 1)
    expect(style(svc({ discriminator: 'electrician' }), 1.5)).toBeUndefined();
    expect(style(svc({ discriminator: 'electrician' }), 1)).toBeDefined();
    // medium tier: up to res 5
    expect(style(svc({ discriminator: 'schools_kindergartens' }), 5)).toBeDefined();
    expect(style(svc({ discriminator: 'schools_kindergartens' }), 6)).toBeUndefined();
    // always tier: fuel stations visible from far away
    expect(style(svc({ discriminator: 'fuel_stations' }), 4000)).toBeDefined();
  });

  it('shows the name label only below the tier threshold', () => {
    expect(labelOf(style(svc({ discriminator: 'electrician', name: 'Ali' }), 0.9))).toBeUndefined();
    expect(labelOf(style(svc({ discriminator: 'electrician', name: 'Ali' }), 0.5))).toBe('Ali');
    expect(labelOf(style(svc({ discriminator: 'fuel_stations', name: 'Station' }), 7))).toBe('Station');
  });

  it('road barriers: status in the label, unknown status handled', () => {
    expect(labelOf(style(svc({ discriminator: 'road_barriers', name: 'Atara', stop: 1 }), 2))).toBe(
      'Atara ([roadStatus.closed])',
    );
    expect(labelOf(style(svc({ discriminator: 'road_barriers', stop: '0' }), 2))).toBe('[roadStatus.open]');
    expect(roadBarrierStatus('x').key).toBe('unknown');
    expect(roadBarrierStatus(4).key).toBe('inspection');
  });

  it('feature text is used as plain text, never as markup', () => {
    expect(
      labelOf(style(svc({ discriminator: 'electrician', name: '<img src=x onerror=alert(1)>' }), 0.5)),
    ).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('real-estate style', () => {
  it('labels the area with the unit only when zoomed in', () => {
    const land = realEstateStyle('land', t);
    const f = new Feature({
      geometry: new Polygon([
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ]),
      area: 550,
    });
    expect(land(f, 2).getText()).toBeFalsy();
    expect(land(f, 1).getText()?.getText()).toBe('550 م²');
  });
  it('formatLabel', () => {
    expect(formatLabel('area', 150, t)).toBe('150 م²');
    expect(formatLabel('area', 0, t)).toBe(''); // a missing area is not drawn (legacy drew "0 م²")
    expect(formatLabel('name', 'x', t)).toBe('x');
    expect(formatLabel('area', null, t)).toBe('');
  });
});

describe('map utils', () => {
  it('reads the legacy ?x=&y= share link', () => {
    expect(readSharedCenter('?x=169463.41&y=145767.99')).toEqual([169463.41, 145767.99]);
    expect(readSharedCenter('?x=abc&y=1')).toBeNull();
    expect(readSharedCenter('')).toBeNull();
  });
  it('formats grid coordinates', () => expect(formatGrid([1.234, 5])).toBe('E: 1.23, N: 5.00'));
  it('grid ↔ GPS round-trips (Al-Manara) and formats lat, lon', () => {
    const [lon, lat] = toLonLat([169463.41, 145767.99]);
    expect(lat).toBeGreaterThan(31.8);
    expect(lat).toBeLessThan(32);
    expect(lon).toBeGreaterThan(35.1);
    expect(lon).toBeLessThan(35.3);
    const [x, y] = fromLonLat(lon, lat);
    expect(x).toBeCloseTo(169463.41, 1);
    expect(y).toBeCloseTo(145767.99, 1);
    expect(formatLatLon([35.2, 31.9])).toBe('31.900000, 35.200000');
  });
  it('maps geolocation errors', () => {
    expect(geolocationErrorKey(1, false)).toBe('map.gps.insecure');
    expect(geolocationErrorKey(1, true)).toBe('map.gps.denied');
    expect(geolocationErrorKey(undefined, true)).toBe('map.gps.failed');
  });
});

describe('WFS urls', () => {
  it('go through the proxy, workspace first then the global endpoint', () => {
    const [a, b] = wfsUrls({
      workspace: 'services',
      typeName: 'service_all',
      srsName: 'EPSG:28191',
      bbox: [1, 2, 3, 4],
    });
    expect(a.startsWith('/geoserver-proxy/services/ows?')).toBe(true);
    expect(b.startsWith('/geoserver-proxy/ows?')).toBe(true);
    const p = new URLSearchParams(a.split('?')[1]);
    expect(p.get('typeName')).toBe('services:service_all');
    expect(p.get('bbox')).toBe('1,2,3,4,EPSG:28191');
  });
});

describe('map UI store', () => {
  beforeEach(() => useMapUi.getState().setAllVisible(true, []));
  it('hide all / show all covers real estate and every service type', () => {
    const keys = SERVICE_TYPES.map((s) => s.key);
    useMapUi.getState().setAllVisible(false, keys);
    expect(useMapUi.getState().hiddenServices.size).toBe(keys.length);
    expect(useMapUi.getState().realEstateVisible).toEqual({ rent: false, sale: false, land: false });
    useMapUi.getState().setAllVisible(true, keys);
    expect(useMapUi.getState().hiddenServices.size).toBe(0);
  });
});
