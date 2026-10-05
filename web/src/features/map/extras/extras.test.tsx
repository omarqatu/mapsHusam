import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';
import i18n from '@/i18n';
import { useSearchUi } from '../search/store';
import { useMapUi } from '../store';
import ExtrasPanel from './ExtrasPanel';
import FeaturedTab from './FeaturedTab';
import StatsTab from './StatsTab';
import StatusTab from './StatusTab';
import { useExtrasUi } from './store';

vi.mock('../geolocate', () => ({
  GeoError: class GeoError extends Error {
    messageKey = 'map.gps.denied';
  },
  locateOnce: vi.fn(),
}));
import { locateOnce } from '../geolocate';

// --- fake backend ---------------------------------------------------------------------------
const point = (x: number, y: number) => ({ type: 'Point', coordinates: [x, y] });
const fc = (features: unknown[]) => ({ type: 'FeatureCollection', features });
const feature = (x: number, y: number, properties: Record<string, unknown>) => ({
  type: 'Feature',
  geometry: point(x, y),
  properties,
});

const BARRIERS = fc([
  feature(1000, 1000, {
    id: 1,
    discriminator: 'road_barriers',
    name: 'Atara',
    des: 'north gate',
    stop: 1,
    stop2: 0,
    rating: '9.0',
    auto_status: 0,
  }),
  feature(2000, 2000, {
    id: 2,
    discriminator: 'road_barriers',
    name: '<img src=x onerror=alert(1)>',
    stop: 0,
    stop2: null,
    auto_status: 0,
  }),
]);
const STATIONS = fc([
  feature(1000, 1000, {
    id: 10,
    discriminator: 'fuel_stations',
    name: 'Jaber station',
    diesel: 0,
    banzen95: 0,
    banzen98: 1,
    auto_status: 0,
  }),
  feature(2000, 2000, {
    id: 11,
    discriminator: 'fuel_stations',
    name: 'Other station',
    diesel: 1,
    banzen95: 1,
    banzen98: 1,
    auto_status: 0,
  }),
]);
const PAINTER = feature(1500, 1500, {
  id: 32,
  discriminator: 'painter',
  name: 'Painter Ali',
  rating: '10.0',
  auto_status: 0,
  work_hours: '',
  phone: '0591234567',
  village_a: 'Al-Bireh',
  pic: 'https://a.com/one.jpg',
  video: 'https://youtu.be/dQw4w9WgXcQ',
  details_link_1: 'https://a.com/before.jpg',
  details_link_2: 'https://a.com/after.jpg',
  des: '<script>alert(1)</script>',
});
const ANOTHER = feature(1600, 1600, {
  id: 40,
  discriminator: 'clinics',
  name: 'Nearby clinic',
  rating: '9.9',
  auto_status: 0,
});
const RENT = feature(1700, 1700, {
  fid: '5',
  price: '750',
  currency: 'USD',
  area: '90',
  location: 'Ramallah',
  auto_status: 0,
  rating: '10',
});
let calls: string[] = [];
/** Per-test changes to the backend: return a value to answer the request differently. */
let override: ((u: URL) => unknown) | null = null;
function backend(url: string, init?: RequestInit): unknown {
  const u = new URL(url, 'http://x');
  const p = u.searchParams;
  const changed = override?.(u);
  if (changed !== undefined) return changed;
  if (u.pathname === '/api/platform-stats')
    return {
      success: true,
      data: {
        usersTotal: 3,
        usersAdmin: 1,
        usersUser: 1,
        usersProvider: 1,
        viewsTotal: 37,
        viewsMap: 30,
        viewsQuickSearch: 7,
        servicesCount: 69,
        featuresCount: 388,
      },
    };
  if (u.pathname === '/api/widgets-data')
    return {
      success: true,
      groups: {},
      road_status_updated_at: new Date().toISOString(),
      fuel_status_updated_at: null,
    };
  if (u.pathname === '/api/provider-linked-features') return { success: true, linked: {} };
  if (u.pathname === '/api/top-rated-providers')
    return {
      success: true,
      items: [
        { service_layer: 'painter', feature_id: 32, avg_rating: '4.5', total_ratings: '7' },
        { service_layer: 'nope', feature_id: 1, avg_rating: '5', total_ratings: '1' },
      ],
    };
  if (u.pathname === '/api/search-features-batch') {
    const body = JSON.parse(String(init?.body)) as { layer: string };
    return fc(body.layer === 'painter' ? [PAINTER] : []);
  }
  if (u.pathname === '/api/search-features') {
    const layer = p.get('layer');
    const rating = p.get('value_0');
    if (layer === 'road_barriers') return BARRIERS;
    if (layer === 'fuel_stations') return STATIONS;
    if (layer === 'service_all') {
      if (rating === '10') return fc([PAINTER]);
      if (rating === '9.9') return fc([ANOTHER]);
      return fc([PAINTER, ANOTHER]); // every service (near me)
    }
    if (layer === 'ApartRent') return fc(rating === '9.9' ? [] : [RENT]);
    return fc([]);
  }
  throw new Error(`unexpected request ${url}`);
}

function renderWith(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('en');
});
afterAll(async () => {
  await i18n.changeLanguage('ar');
});
beforeEach(() => {
  calls = [];
  override = null;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input));
      return Promise.resolve(new Response(JSON.stringify(backend(String(input), init)), { status: 200 }));
    }),
  );
  useMapUi.setState({ selected: null, layersOpen: false });
  useSearchUi.setState({ panelOpen: false, results: null });
  useExtrasUi.setState({ open: false, tab: 'featured' });
});
afterEach(() => vi.unstubAllGlobals());

describe('StatsTab', () => {
  it('shows every platform counter', async () => {
    renderWith(<StatsTab />);
    expect(await screen.findByText('Users')).toBeInTheDocument();
    for (const [label, value] of [
      ['Users', '3'],
      ['Service providers', '388'],
      ['Services', '69'],
      ['Total platform visits', '37'],
      ['Map visits', '30'],
      ['Quick-search visits', '7'],
    ])
      expect(screen.getByText(label).closest('div')!.parentElement).toHaveTextContent(`${label}${value}`);
    expect(screen.getByText('Users by role')).toBeInTheDocument();
  });

  it('shows an error when the server fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    renderWith(<StatsTab />);
    // stats retry 3 times with growing delay; the error appears once they are used up
    expect(
      await screen.findByText(/Could not load the statistics/, undefined, { timeout: 9000 }),
    ).toBeInTheDocument();
  }, 12000);
});

describe('StatusTab — road checkpoints', () => {
  it('lists every checkpoint with inbound and outbound status, and how fresh the data is', async () => {
    renderWith(<StatusTab layer="road_barriers" />);
    expect(await screen.findByText('Atara')).toBeInTheDocument();
    expect(screen.getByText('(north gate)')).toBeInTheDocument();
    const row = screen.getByText('Atara').closest('button')!;
    expect(within(row).getByText(/Inbound: .*Closed/)).toBeInTheDocument();
    expect(within(row).getByText(/Outbound: .*Open/)).toBeInTheDocument();
    // a missing `stop2` is "not set", not a guess
    const second = screen.getByText('<img src=x onerror=alert(1)>').closest('button')!;
    expect(within(second).getByText(/Outbound: .*Not set/)).toBeInTheDocument();
    expect(await screen.findByText('just now')).toBeInTheDocument();
    expect(calls.some((c) => c.includes('layer=road_barriers') && c.includes('workspace=services'))).toBe(
      true,
    );
  });

  it('renders names as text, never as HTML', async () => {
    renderWith(<StatusTab layer="road_barriers" />);
    await screen.findByText('Atara');
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img[onerror]')).toBeNull();
  });

  it('the search box matches names and status words', async () => {
    const user = userEvent.setup();
    renderWith(<StatusTab layer="road_barriers" />);
    await screen.findByText('Atara');
    const box = screen.getByRole('searchbox');
    await user.type(box, 'closed');
    await waitFor(() => expect(screen.queryByText('<img src=x onerror=alert(1)>')).toBeNull());
    expect(screen.getByText('Atara')).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'zzz');
    expect(await screen.findByText('No matching results')).toBeInTheDocument();
  });

  it('tapping a row opens its details card on the map', async () => {
    const user = userEvent.setup();
    renderWith(<StatusTab layer="road_barriers" />);
    await user.click((await screen.findByText('Atara')).closest('button')!);
    const sel = useMapUi.getState().selected!;
    expect(sel.id).toBe('1');
    expect(sel.kind).toEqual({ kind: 'service', discriminator: 'road_barriers' });
    expect(sel.coordinate).toEqual([1000, 1000]);
  });

  it('shows the server failure instead of an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    renderWith(<StatusTab layer="road_barriers" />);
    expect(await screen.findByText(/Could not load the data/)).toBeInTheDocument();
  });
});

describe('StatusTab — fuel stations', () => {
  it('shows availability of diesel, 95 and 98 per station', async () => {
    renderWith(<StatusTab layer="fuel_stations" />);
    const row = (await screen.findByText('Jaber station')).closest('button')!;
    const items = within(row).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining('Diesel'),
      expect.stringContaining('Petrol 95'),
      expect.stringContaining('Petrol 98'),
    ]);
    expect(within(items[0]).getByText('Available')).toBeInTheDocument();
    expect(within(items[2]).getByText('Not available')).toBeInTheDocument();
    expect(screen.getByText('no update yet')).toBeInTheDocument(); // fuel_status_updated_at is null
  });

  it('search finds stations by name and by fuel name', async () => {
    const user = userEvent.setup();
    renderWith(<StatusTab layer="fuel_stations" />);
    await screen.findByText('Jaber station');
    await user.type(screen.getByRole('searchbox'), 'jaber');
    await waitFor(() => expect(screen.queryByText('Other station')).toBeNull());
    expect(screen.getByText('Jaber station')).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'petrol 98');
    expect(await screen.findByText('Other station')).toBeInTheDocument(); // every station lists the fuels
  });
});

describe('FeaturedTab', () => {
  it('shows the rating sections and the media sections built from them', async () => {
    renderWith(<FeaturedTab />);
    const sections = async (title: string) =>
      (await screen.findByRole('heading', { name: title })).closest('section')!;

    const featured = await sections('Featured');
    expect(await within(featured).findByText('Painter Ali')).toBeInTheDocument();
    expect(within(featured).getByText(/Featured · Painter/)).toBeInTheDocument();
    // the first property is always shown
    expect(within(featured).getByText(/Featured · Apartments for rent/)).toBeInTheDocument();
    expect(within(featured).getByText('750 USD')).toBeInTheDocument();

    const recommended = await sections('Recommended');
    expect(await within(recommended).findByText('Nearby clinic')).toBeInTheDocument();

    const topRated = await sections('Top rated');
    const top = await within(topRated).findByText('Painter Ali');
    expect(top).toBeInTheDocument();
    expect(within(topRated).getByText('4.5')).toBeInTheDocument();
    expect(within(topRated).getByText('(7)')).toBeInTheDocument();

    // before / after is no longer a section of its own: it lives in the listing's card
    expect(screen.queryByRole('heading', { name: 'Before & after' })).toBeNull();
    expect(within(await sections('Photos')).getByText('Painter Ali')).toBeInTheDocument();
    expect(within(await sections('Videos')).getByText('Painter Ali')).toBeInTheDocument();
  });

  it('asks for exactly what legacy asked for', async () => {
    renderWith(<FeaturedTab />);
    await screen.findByRole('heading', { name: 'Top rated' });
    await waitFor(() => expect(calls.some((c) => c.startsWith('/api/search-features-batch'))).toBe(true));
    const search = calls.filter((c) => c.startsWith('/api/search-features?'));
    for (const value of ['10', '9.9'])
      for (const layer of ['service_all', 'ApartRent', 'ApartSale', 'LandSale'])
        expect(
          search.some(
            (c) =>
              c.includes(`layer=${layer}`) &&
              c.includes('field_0=rating') &&
              c.includes(`value_0=${encodeURIComponent(value)}`),
          ),
        ).toBe(true);
    expect(calls).toContain('/api/top-rated-providers?limit=15');
    // an unknown service type from the ranking is dropped, the known one is fetched by id
    expect(calls.filter((c) => c.startsWith('/api/search-features-batch'))).toHaveLength(1);
  });

  it("a card with before / after pictures switches between them and the photos, opening on the provider's choice", async () => {
    const user = userEvent.setup();
    renderWith(<FeaturedTab />);
    const featured = (await screen.findByRole('heading', { name: 'Featured' })).closest('section')!;
    const card = (await within(featured).findByText('Painter Ali')).closest('article')!;
    const photos = within(card).getByRole('tab', { name: 'Photos' });
    expect(photos).toHaveAttribute('aria-selected', 'true');
    expect(within(card).queryByText('Before')).toBeNull();
    await user.click(within(card).getByRole('tab', { name: 'Before & after' }));
    expect(within(card).getByText('Before')).toBeInTheDocument();
    expect(within(card).getByText('After')).toBeInTheDocument();
  });

  it('opens on before / after when the provider chose it', async () => {
    override = (u) =>
      u.pathname === '/api/search-features' &&
      u.searchParams.get('layer') === 'service_all' &&
      u.searchParams.get('value_0') === '10'
        ? fc([{ ...PAINTER, properties: { ...PAINTER.properties, media_default: 'before_after' } }])
        : undefined;
    renderWith(<FeaturedTab />);
    const featured = (await screen.findByRole('heading', { name: 'Featured' })).closest('section')!;
    const card = (await within(featured).findByText('Painter Ali')).closest('article')!;
    expect(within(card).getByRole('tab', { name: 'Before & after' })).toHaveAttribute('aria-selected', 'true');
    expect(within(card).getByText('Before')).toBeInTheDocument();
  });

  it('a section with nothing to show is left out', async () => {
    override = (u) =>
      u.pathname === '/api/search-features' && u.searchParams.get('value_0') === '9.9' ? fc([]) : undefined;
    renderWith(<FeaturedTab />);
    await screen.findByRole('heading', { name: 'Featured' });
    await screen.findByRole('heading', { name: 'Photos' });
    expect(screen.queryByRole('heading', { name: 'Recommended' })).toBeNull();
  });

  it('a hotel shows its price and area and its customers\' rating, not the hand-set stars', async () => {
    const HOTEL = feature(1900, 1900, {
      id: 77,
      discriminator: 'hotels',
      name: 'Hotel Jericho',
      rating: '10',
      price: '120',
      currency: 'ILS',
      area: '300',
      auto_status: 0,
    });
    override = (u) => {
      const p = u.searchParams;
      if (u.pathname === '/api/search-features' && p.get('layer') === 'service_all' && p.get('value_0') === '10')
        return fc([PAINTER, HOTEL]);
      if (u.pathname === '/api/service-ratings')
        return p.get('feature_id') === '77'
          ? { success: true, averageRating: 3.5, totalRatings: 2, ratings: [] }
          : { success: true, averageRating: 0, totalRatings: 0, ratings: [] };
      return undefined;
    };
    renderWith(<FeaturedTab />);
    const featured = (await screen.findByRole('heading', { name: 'Featured' })).closest('section')!;
    const card = (await within(featured).findByText('Hotel Jericho')).closest('article')!;
    expect(within(card).getByText('120 ILS')).toBeInTheDocument();
    expect(within(card).getByText(/300/)).toBeInTheDocument();
    expect(await within(card).findByText('3.5')).toBeInTheDocument();
    expect(calls).toContain('/api/service-ratings?service_layer=hotels&feature_id=77');
  });

  it('user text is never interpreted as HTML', async () => {
    renderWith(<FeaturedTab />);
    await screen.findAllByText('Painter Ali');
    expect(screen.getAllByText('<script>alert(1)</script>').length).toBeGreaterThan(0);
    expect(document.querySelector('script')).toBeNull();
  });

  it('"show on map" opens the details card', async () => {
    const user = userEvent.setup();
    renderWith(<FeaturedTab />);
    const featured = (await screen.findByRole('heading', { name: 'Featured' })).closest('section')!;
    const card = (await within(featured).findByText('Painter Ali')).closest('article')!;
    await user.click(within(card).getByRole('button', { name: 'Show on map' }));
    expect(useMapUi.getState().selected?.id).toBe('32');
  });

  it('near me: locates once, then lists the closest features nearest first, filterable by type', async () => {
    const user = userEvent.setup();
    vi.mocked(locateOnce).mockResolvedValue([1590, 1590]);
    renderWith(<FeaturedTab />);
    expect(screen.getByText(/Turn on location/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Locate me/ }));

    const nearSection = (await screen.findByRole('heading', { name: 'Services near me' })).closest(
      'section',
    )!;
    expect(await within(nearSection).findByText(/Nearest \d+ results/)).toBeInTheDocument();
    const names = within(nearSection)
      .getAllByRole('heading', { level: 5 })
      .map((h) => h.textContent);
    expect(names.slice(0, 2).map((n) => n?.replace(/^\P{L}+/u, ''))).toEqual([
      'Nearby clinic',
      'Painter Ali',
    ]); // 10 m and 90 m away
    expect(within(nearSection).getAllByText(/^\d+ m$/).length).toBeGreaterThan(0);
    expect(useSearchUi.getState().nearbyCenter).toEqual([1590, 1590]);

    // one type only
    await user.click(within(nearSection).getByRole('button', { name: /Filter by service or property type/ }));
    await user.type(
      within(nearSection).getByRole('searchbox', { name: 'Search for a service or property' }),
      'Painter',
    );
    await user.click(await within(nearSection).findByRole('checkbox', { name: /Painter/ }));
    await waitFor(() =>
      expect(
        within(nearSection)
          .getAllByRole('heading', { level: 5 })
          .map((h) => h.textContent?.replace(/^\P{L}+/u, '')),
      ).toEqual(['Painter Ali']),
    );
  });

  it('near me: a preset button selects that type and locates', async () => {
    const user = userEvent.setup();
    vi.mocked(locateOnce).mockResolvedValue([1000, 1000]);
    renderWith(<FeaturedTab />);
    const nearSection = (await screen.findByRole('heading', { name: 'Services near me' })).closest(
      'section',
    )!;
    await user.click(within(nearSection).getByRole('button', { name: /Road checkpoints/ }));
    await waitFor(() =>
      expect(
        within(nearSection).getByRole('button', { name: /Filter by service or property type \(1\)/ }),
      ).toBeInTheDocument(),
    );
    // the fake backend answers `service_all` with painter + clinic only, so nothing matches — and the list says so
    expect(
      await within(nearSection).findByText('No nearby results for the selected types'),
    ).toBeInTheDocument();
  });
});

describe('ExtrasPanel', () => {
  it('is closed by default and opens on the requested tab', async () => {
    renderWith(<ExtrasPanel />);
    expect(screen.queryByRole('complementary')).toBeNull();
    useExtrasUi.getState().openPanel('roads');
    expect(await screen.findByRole('tab', { name: /Roads/, selected: true })).toBeInTheDocument();
    expect(await screen.findByText('Atara')).toBeInTheDocument();
  });

  it('loads a tab only when it is first shown', async () => {
    const user = userEvent.setup();
    useExtrasUi.setState({ open: true, tab: 'roads' });
    renderWith(<ExtrasPanel />);
    await screen.findByText('Atara');
    expect(calls.some((c) => c.includes('/api/platform-stats'))).toBe(false);
    expect(calls.some((c) => c.includes('top-rated'))).toBe(false);
    await user.click(screen.getByRole('tab', { name: /Stats/ }));
    expect(await screen.findByText('388')).toBeInTheDocument();
    // back to roads: still there, not refetched from scratch
    await user.click(screen.getByRole('tab', { name: /Roads/ }));
    expect(screen.getByText('Atara')).toBeVisible();
  });

  it('closes with the button and with Escape, but Escape first closes a details card', async () => {
    const user = userEvent.setup();
    useExtrasUi.setState({ open: true, tab: 'stats' });
    renderWith(<ExtrasPanel />);
    await screen.findByText('388');
    // a card is open: Escape is left to the page handler (which closes the card)
    useMapUi.setState({ selected: { kind: { kind: 'location' }, id: null, props: {}, coordinate: [1, 2] } });
    await user.keyboard('{Escape}');
    expect(useExtrasUi.getState().open).toBe(true);
    useMapUi.setState({ selected: null });
    await user.keyboard('{Escape}');
    expect(useExtrasUi.getState().open).toBe(false);
  });

  it('gives way to the layer panel and to the search panel', async () => {
    useExtrasUi.setState({ open: true, tab: 'stats' });
    renderWith(<ExtrasPanel />);
    await screen.findByText('388');
    useMapUi.getState().setLayersOpen(true);
    await waitFor(() => expect(useExtrasUi.getState().open).toBe(false));
    useExtrasUi.setState({ open: true });
    useSearchUi.getState().openPanel();
    await waitFor(() => expect(useExtrasUi.getState().open).toBe(false));
  });
});
