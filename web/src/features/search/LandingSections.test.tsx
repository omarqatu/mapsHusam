import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import i18n from '@/i18n';
import LandingSections from './LandingSections';

// The /search landing rows: same data as the map's featured portal, shown as rows of listing cards.

const fc = (features: unknown[]) => ({ type: 'FeatureCollection', features });
const feature = (x: number, properties: Record<string, unknown>) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [x, x] },
  properties,
});

const HOTEL = feature(1000, {
  id: 77,
  discriminator: 'hotels',
  name: 'Hotel Jericho',
  rating: '10',
  price: '120',
  currency: 'ILS',
  area: '300',
  auto_status: 0,
});
const PLUMBER = feature(1100, {
  id: 5,
  discriminator: 'plumber',
  name: 'Plumber Omar',
  rating: '10',
  auto_status: 0,
});
const RENT = feature(1200, {
  fid: '9',
  location: 'Ramallah',
  price: '750',
  currency: 'USD',
  rating: '10',
  auto_status: 0,
});

let calls: string[] = [];
let topRatedFails = false;

function backend(url: string): Response {
  const u = new URL(url, 'http://x');
  const p = u.searchParams;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  if (u.pathname === '/api/search-features') {
    const layer = p.get('layer');
    if (p.get('value_0') !== '10') return json(fc([]));
    if (layer === 'service_all') return json(fc([HOTEL, PLUMBER]));
    if (layer === 'ApartRent') return json(fc([RENT]));
    return json(fc([]));
  }
  if (u.pathname === '/api/top-rated-providers')
    return topRatedFails ? json({ success: false }, 500) : json({ success: true, items: [] });
  if (u.pathname === '/api/service-ratings')
    return json(
      p.get('feature_id') === '77'
        ? { success: true, averageRating: 3.5, totalRatings: 2, ratings: [] }
        : { success: true, averageRating: 0, totalRatings: 0, ratings: [] },
    );
  if (u.pathname === '/api/provider-linked-features') return json({ success: true, linked: {} });
  return json({ success: false }, 404);
}

function renderLanding() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LandingSections />
      </MemoryRouter>
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
  topRatedFails = false;
  // jsdom has no ResizeObserver (the scroll rows watch their width for the arrows).
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      calls.push(String(input));
      return Promise.resolve(backend(String(input)));
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const row = async (title: string) =>
  (await screen.findByRole('heading', { name: title })).closest('section')!;
const card = async (section: HTMLElement, name: string) =>
  (await within(section).findByText(name)).closest('article')!;

describe('LandingSections', () => {
  it("service cards show the customers' real rating (or none yet), property keeps its stars", async () => {
    renderLanding();
    const featured = await row('Featured');

    const hotel = await card(featured, 'Hotel Jericho');
    expect(within(hotel).getByText('120 ILS')).toBeInTheDocument();
    expect(await within(hotel).findByText('3.5')).toBeInTheDocument();
    expect(within(hotel).getByText('(2)')).toBeInTheDocument();
    expect(calls).toContain('/api/service-ratings?service_layer=hotels&feature_id=77');

    const plumber = await card(featured, 'Plumber Omar');
    expect(await within(plumber).findByText('No ratings yet')).toBeInTheDocument();
    // not the hand-set 10 shown as five stars
    expect(within(plumber).queryByText('5')).toBeNull();

    const rent = await card(featured, 'Ramallah');
    expect(within(rent).getByText('5')).toBeInTheDocument();
    expect(calls.some((c) => c.includes('service_layer=rent'))).toBe(false);
  });

  it('a row whose request failed is left out instead of loading for ever; empty rows too', async () => {
    topRatedFails = true;
    renderLanding();
    await row('Featured');
    await vi.waitFor(() => expect(calls).toContain('/api/top-rated-providers?limit=15'));
    // let the failed request settle
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('heading', { name: 'Top rated' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Recommended' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Before & after' })).toBeNull();
  });
});
