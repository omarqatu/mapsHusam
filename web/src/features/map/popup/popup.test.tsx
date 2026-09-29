import { beforeEach, describe, expect, it, vi } from 'vitest';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';
import {
  barrierDirections,
  collectMedia,
  fuelAvailable,
  isOpenNow,
  locationShareLink,
  parseUrlList,
  parseWorkHours,
  prop,
  resolveFeatureId,
  safeMediaUrl,
  telLink,
  whatsappLink,
} from './featureModel';
import { cooldownRemaining } from './useContactActions';
import { featureToSelection } from './selection';
import FeatureCard from './FeatureCard';
import type { SelectedFeature } from './featureModel';

describe('safeMediaUrl (URLs come from user data)', () => {
  it('upgrades http, adds a missing protocol, unwraps <img src>', () => {
    expect(safeMediaUrl('http://a.com/x.jpg')).toBe('https://a.com/x.jpg');
    expect(safeMediaUrl('a.com/x.jpg')).toBe('https://a.com/x.jpg');
    expect(safeMediaUrl('<img src="http://a.com/p.png">')).toBe('https://a.com/p.png');
    expect(safeMediaUrl('//a.com/p.png')).toBe('https://a.com/p.png');
  });
  it('rejects empties and non-web schemes', () => {
    for (const bad of [
      undefined,
      null,
      '',
      '#',
      'undefined',
      'null',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://a.com/x',
      'localhost',
    ]) {
      expect(safeMediaUrl(bad)).toBeNull();
    }
  });
});

describe('media lists', () => {
  it('parses lists, JSON and brackets', () => {
    expect(parseUrlList('a.com/1.jpg, b.com/2.jpg\nc.com/3.jpg|d.com/4.jpg')).toHaveLength(4);
    expect(parseUrlList('["a.com/1.jpg","b.com/2.jpg"]')).toEqual(['a.com/1.jpg', 'b.com/2.jpg']);
    expect(parseUrlList('{"url":"a.com/1.jpg"}')).toEqual(['a.com/1.jpg']);
    expect(parseUrlList('#')).toEqual([]);
  });
  it('collects pictures, then video, then detail links — youtube/video/link/image typed', () => {
    const items = collectMedia({
      pic: 'a.com/1.jpg,b.com/2.png',
      video: 'https://youtu.be/dQw4w9WgXcQ',
      details_link_1: 'https://facebook.com/page',
      details_link_2: 'https://x.com/photo.webp',
    });
    expect(items.map((i) => i.type)).toEqual(['image', 'image', 'youtube', 'link', 'image']);
    expect(items[2]).toEqual({ type: 'youtube', id: 'dQw4w9WgXcQ' });
  });
  it('drops javascript: links entirely', () => {
    expect(collectMedia({ details_link_1: 'javascript:alert(1)' })).toEqual([]);
  });
});

describe('feature data helpers', () => {
  it('reads properties case/punctuation-insensitively', () => {
    expect(prop({ Banzen95: 0 }, 'banzen95')).toBe(0);
    expect(prop({ work_hours: 'x' }, 'workHours')).toBe('x');
  });
  it('resolves the feature id like legacy: id → fid → feature_id → WFS id suffix', () => {
    expect(resolveFeatureId({ id: 7 }, 'service_all.99')).toBe('7');
    expect(resolveFeatureId({ fid: 8 }, undefined)).toBe('8');
    expect(resolveFeatureId({}, 'service_all.99')).toBe('99');
    expect(resolveFeatureId({}, undefined)).toBeNull();
  });
  it('work hours: all day / range / free text', () => {
    expect(parseWorkHours('')).toEqual({ allDay: true });
    expect(parseWorkHours('00:00-23:59')).toEqual({ allDay: true });
    expect(parseWorkHours('08:00-17:30')).toEqual({ allDay: false, from: '08:00', to: '17:30' });
    expect(parseWorkHours('بعد العصر')).toEqual({ allDay: false, raw: 'بعد العصر' });
  });
  it('auto_status 0 = open; fuel 0 = available; barrier directions', () => {
    expect(isOpenNow(0)).toBe(true);
    expect(isOpenNow('1')).toBe(false);
    expect(fuelAvailable({ diesel: 0 }, 'diesel')).toBe(true);
    expect(fuelAvailable({ diesel: 1 }, 'diesel')).toBe(false);
    const d = barrierDirections({ stop: 1, stop2: '' });
    expect(d.inbound.key).toBe('closed');
    expect(d.outbound).toBeNull();
    expect(barrierDirections({ stop: 0, stop2: 3 }).outbound?.key).toBe('heavy');
  });
});

describe('contact links', () => {
  it('whatsapp: digits only, strips 00, encodes the message', () => {
    const u = new URL(whatsappLink('00970 59-123 4567', 'مرحباً & test')!);
    expect(u.searchParams.get('phone')).toBe('970591234567');
    expect(u.searchParams.get('text')).toBe('مرحباً & test');
    expect(u.host).toBe('api.whatsapp.com');
    expect(whatsappLink('abc', 'x')).toBeNull();
  });
  it('tel and share links', () => {
    expect(telLink('059-123 4567')).toBe('tel:0591234567');
    expect(telLink('---')).toBeNull();
    expect(locationShareLink('https://h.example', '/', [1.5, 2])).toBe('https://h.example/?x=1.5&y=2');
  });
});

describe('click cooldown (10 s, legacy localStorage key)', () => {
  beforeEach(() => localStorage.clear());
  it('blocks a second click inside 10 s, allows after', () => {
    expect(cooldownRemaining('call', '5', 1_000_000)).toBe(0);
    expect(cooldownRemaining('call', '5', 1_003_000)).toBe(7);
    expect(cooldownRemaining('whatsapp', '5', 1_003_000)).toBe(0); // separate per action
    expect(cooldownRemaining('call', '5', 1_011_000)).toBe(0);
    expect(localStorage.getItem('click_cooldown_call_5')).toBe('1011000');
  });
});

describe('featureToSelection', () => {
  const layer = (key: string) => ({ get: (n: string) => (n === 'key' ? key : undefined) });
  it('service feature → snapshot with discriminator; unknown discriminator ignored', () => {
    const f = new Feature({ geometry: new Point([1, 2]), discriminator: 'plumber', name: 'Ali' });
    f.setId('service_all.12');
    const s = featureToSelection(f, layer('services'), [1, 2])!;
    expect(s.kind).toMatchObject({ kind: 'service', discriminator: 'plumber' });
    expect(s.id).toBe('12');
    expect(s.props).not.toHaveProperty('geometry');
    expect(featureToSelection(new Feature({ discriminator: 'nope' }), layer('services'), [0, 0])).toBeNull();
  });
  it('real estate + unknown layers', () => {
    expect(featureToSelection(new Feature({ fid: 3 }), layer('rent'), [0, 0])?.kind).toEqual({
      kind: 'realEstate',
      layer: 'rent',
    });
    expect(featureToSelection(new Feature({}), layer('other'), [0, 0])).toBeNull();
    expect(featureToSelection(new Feature({}), null, [0, 0])).toBeNull();
  });
});

describe('FeatureCard', () => {
  const wrap = (f: SelectedFeature) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <FeatureCard feature={f} onClose={() => undefined} />
      </QueryClientProvider>,
    );
  };
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response(
              JSON.stringify({ success: true, ratings: [], averageRating: 0, totalRatings: 0, linked: {} }),
              { status: 200 },
            ),
          ),
        ),
    );
  });

  it('renders user text as text (no HTML injection) and shows call + WhatsApp', () => {
    wrap({
      kind: { kind: 'service', discriminator: 'plumber', icon: '🔧' },
      id: '5',
      coordinate: [1, 2],
      props: {
        name: '<img src=x onerror=alert(1)>',
        des: '<script>alert(1)</script>',
        phone: '0591234567',
        whatsapp: '970591234567',
        auto_status: 0,
        work_hours: '',
      },
    });
    expect(screen.getAllByText('<img src=x onerror=alert(1)>').length).toBeGreaterThan(0);
    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByRole('button', { name: /اتصال|Call/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /واتساب|WhatsApp/ })).toBeInTheDocument();
  });

  it('road barrier: two direction tiles, no contact buttons', () => {
    wrap({
      kind: { kind: 'service', discriminator: 'road_barriers', icon: '🚧' },
      id: '1',
      coordinate: [1, 2],
      props: { name: 'Atara', stop: 1, stop2: 0, phone: '059', whatsapp: '970' },
    });
    expect(screen.getByText(/للداخل|Inbound/)).toBeInTheDocument();
    expect(screen.getByText(/للخارج|Outbound/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /اتصال|Call/ })).toBeNull();
  });

  it('real estate: price with currency and area with unit', async () => {
    wrap({
      kind: { kind: 'realEstate', layer: 'sale' },
      id: '9',
      coordinate: [1, 2],
      props: { name: 'Owner', price: 50000, currency: 'USD', area: 120, auto_status: 0 },
    });
    expect(await screen.findByText(/(50|٥٠)[,٬](000|٠٠٠)/)).toBeInTheDocument();
    expect(screen.getByText(/120 (م²|m²)/)).toBeInTheDocument();
  });
});
