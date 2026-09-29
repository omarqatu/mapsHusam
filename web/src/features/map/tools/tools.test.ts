import { describe, expect, it, vi } from 'vitest';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import Circle from 'ol/geom/Circle';
import DoubleClickZoom from 'ol/interaction/DoubleClickZoom';
import OlMap from 'ol/Map';
import { readSharedCenter, readSharedZoom } from '../mapUtils';
import { DEFAULT_CENTER } from '../config';
import { fromLonLat, toLonLat } from '../projection';
import { copyText } from '@/lib/clipboard';
import { formatMeasureNumber, measureGeometry, setDoubleClickZoom } from './measure';
import { googleMapsLink, gridClipboard, gridDisplay, shareLink, wgsClipboard, wgsDisplay } from './share';

describe('measureGeometry (planar metres, like legacy)', () => {
  it('area of a 10 x 20 m rectangle', () => {
    const poly = new Polygon([
      [
        [0, 0],
        [10, 0],
        [10, 20],
        [0, 20],
        [0, 0],
      ],
    ]);
    expect(measureGeometry(poly)).toEqual({ kind: 'area', squareMeters: 200 });
  });

  it('length of a 3-4-5 line and of a two-segment line', () => {
    expect(
      measureGeometry(
        new LineString([
          [0, 0],
          [3, 4],
        ]),
      ),
    ).toEqual({ kind: 'length', meters: 5 });
    expect(
      measureGeometry(
        new LineString([
          [0, 0],
          [3, 4],
          [3, 14],
        ]),
      ),
    ).toEqual({ kind: 'length', meters: 15 });
  });

  it('a point reports easting / northing', () => {
    expect(measureGeometry(new Point([169463.41, 145767.99]))).toEqual({
      kind: 'point',
      easting: 169463.41,
      northing: 145767.99,
    });
  });

  it('other geometries are not measurable', () => {
    expect(measureGeometry(new Circle([0, 0], 5))).toBeNull();
  });

  it('formats with 3 decimals and Latin digits', () => {
    expect(formatMeasureNumber(5)).toBe('5.000');
    expect(formatMeasureNumber(1234.56789)).toBe('1234.568');
    expect(formatMeasureNumber(0.0004)).toBe('0.000');
  });
});

describe('double-click zoom switch', () => {
  it('turns the map default interaction off and on', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const map = new OlMap({});
    const dbl = () =>
      map
        .getInteractions()
        .getArray()
        .find((i) => i instanceof DoubleClickZoom)!;
    expect(dbl().getActive()).toBe(true);
    setDoubleClickZoom(map, false);
    expect(dbl().getActive()).toBe(false);
    setDoubleClickZoom(map, true);
    expect(dbl().getActive()).toBe(true);
  });
});

describe('share formats', () => {
  it('shows and copies Palestine Grid coordinates to 3 decimals', () => {
    expect(gridDisplay([169463.4106, 145767.99])).toBe('E: 169463.411, N: 145767.990');
    expect(gridClipboard([169463.4106, 145767.99])).toBe('169463.411,145767.990');
  });

  it('converts Palestine Grid to WGS84 (lat first, 6 decimals)', () => {
    // Al-Manara square, Ramallah: about 31.90 N, 35.20 E.
    const [lon, lat] = toLonLat(DEFAULT_CENTER);
    expect(lat).toBeGreaterThan(31.89);
    expect(lat).toBeLessThan(31.91);
    expect(lon).toBeGreaterThan(35.19);
    expect(lon).toBeLessThan(35.21);
    expect(wgsDisplay(DEFAULT_CENTER)).toMatch(/^Lat: 31\.\d{6} , Lon: 35\.\d{6}$/);
    expect(wgsClipboard(DEFAULT_CENTER)).toMatch(/^31\.\d{6},35\.\d{6}$/);
  });

  it('round-trips through WGS84 within a centimetre', () => {
    const [lon, lat] = toLonLat(DEFAULT_CENTER);
    const back = fromLonLat(lon, lat);
    expect(Math.abs(back[0] - DEFAULT_CENTER[0])).toBeLessThan(0.01);
    expect(Math.abs(back[1] - DEFAULT_CENTER[1])).toBeLessThan(0.01);
  });

  it('opens Google Maps at lat,lon', () => {
    expect(googleMapsLink(DEFAULT_CENTER)).toBe(
      `https://www.google.com/maps?q=${wgsClipboard(DEFAULT_CENTER)}`,
    );
  });

  it('builds the ?x=&y=&z= link with rounded coordinates and zoom', () => {
    const url = new URL(shareLink('https://map.example', '/', [169463.41049, 145767.9951], 18.4));
    expect(url.origin + url.pathname).toBe('https://map.example/');
    expect(url.searchParams.get('x')).toBe('169463.41');
    expect(url.searchParams.get('y')).toBe('145767.995');
    expect(url.searchParams.get('z')).toBe('18');
  });

  it('the link is read back by the map (centre and zoom)', () => {
    const url = new URL(shareLink('https://map.example', '/', [169463.41, 145767.99], 19));
    expect(readSharedCenter(url.search)).toEqual([169463.41, 145767.99]);
    expect(readSharedZoom(url.search)).toBe(19);
    expect(readSharedZoom('?x=1&y=2')).toBeNull();
    expect(readSharedZoom('?z=abc')).toBeNull();
  });
});

describe('copyText', () => {
  it('uses the async clipboard when present', async () => {
    let written = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (s: string) => ((written = s), Promise.resolve()) },
    });
    expect(await copyText('1,2')).toBe(true);
    expect(written).toBe('1,2');
  });

  it('reports failure when the clipboard rejects', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
    expect(await copyText('1,2')).toBe(false);
  });
});
