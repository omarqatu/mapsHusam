import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import i18n from '@/i18n';
import type { AuthUser } from '@/types/auth';
import { useAuthStore } from '@/store/authStore';
import { ALL_TARGETS, targetKey, type MapTarget } from '../map/targets';
import PropertyServices from './PropertyServices';

// The card's "Services for this land": collapsed line, tabs with counts, the ranking, and its measurement.

const land = ALL_TARGETS.find((t) => targetKey(t) === 'land') as MapTarget;
const flat = ALL_TARGETS.find((t) => targetKey(t) === 'rent') as MapTarget;
const ORIGIN: [number, number] = [170000, 145000];
const GOV = 'رام الله والبيرة';

const fc = (features: unknown[]) => ({ type: 'FeatureCollection', features });
/** A provider `km` kilometres east of the land. */
const at = (km: number, props: Record<string, unknown>) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [ORIGIN[0] + km * 1000, ORIGIN[1]] },
  properties: { gov_a: GOV, auto_status: 0, status: 0, ...props },
});

const SURVEYORS = [
  at(1, { id: 1, name: 'Near but in Nablus', gov_a: 'نابلس' }),
  at(10, { id: 2, name: 'Far but proven' }),
  at(2, { id: 3, name: 'Near but closed', auto_status: 1 }),
  at(3, { id: 4, name: 'Third' }),
  at(6, { id: 5, name: 'Fourth' }),
];
const VALUERS = [at(4, { id: 9, name: 'The valuer' })];

let calls: { url: string; body?: string }[] = [];
let layers: Record<string, unknown[]> = {};
let saved: string | null = null;

function backend(url: string): unknown {
  const u = new URL(url, 'http://x');
  const p = u.searchParams;
  if (u.pathname === '/api/platform-content/settings.propertyServices')
    return { success: true, item: saved ? { content_key: 'k', label: 'l', content_value: saved, updated_at: '' } : null };
  if (u.pathname === '/api/search-features') return fc(layers[p.get('layer') ?? ''] ?? []);
  if (u.pathname === '/api/service-ratings-summary')
    return {
      success: true,
      items: p.get('service_layer') === 'land_surveyors' ? [{ feature_id: 2, avg_rating: '4.8', total_ratings: 30 }] : [],
    };
  if (u.pathname === '/api/provider-linked-features') return { success: true, linked: {} };
  if (u.pathname === '/api/log-map-event') return { status: 'success' };
  throw new Error(`unexpected request ${url}`);
}

function renderCard(target = land, props: Record<string, unknown> = { gov_a: GOV }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PropertyServices target={target} origin={ORIGIN} props={props} />
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
  saved = null;
  layers = { land_surveyors: SURVEYORS, real_estate_valuers: VALUERS, lawyers: [] };
  useAuthStore.setState({ user: { user_id: 3, token: 't' } as AuthUser });
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: typeof init?.body === 'string' ? init.body : undefined });
      return Promise.resolve(new Response(JSON.stringify(backend(String(input))), { status: 200 }));
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null });
});

const logged = () => calls.filter((c) => c.url === '/api/log-map-event').map((c) => JSON.parse(c.body ?? '{}'));

describe('PropertyServices', () => {
  it('is one quiet line until asked, listing only the types somebody offers', async () => {
    renderCard();
    const header = await screen.findByRole('button', { name: /Services for this land/ });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(within(header).getByText('Land surveyors · Real-estate valuers')).toBeInTheDocument(); // lawyers: nobody yet
    expect(screen.queryByRole('tab')).toBeNull();
    expect(logged()).toEqual([]);
  });

  it('shows nothing for a property kind with no services, and when no type has anyone', async () => {
    const { unmount } = renderCard(flat);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: /Services for/ })).toBeNull();
    unmount();
    layers = { land_surveyors: [], real_estate_valuers: [], lawyers: [] };
    renderCard();
    await waitFor(() => expect(calls.some((c) => c.url.includes('layer=lawyers'))).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: /Services for/ })).toBeNull();
  });

  it('opens on tabs with counts; the best come first — not the nearest', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(await screen.findByRole('button', { name: /Services for this land/ }));
    expect(screen.getByRole('tab', { name: /Land surveyors \(5\)/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Real-estate valuers \(1\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Lawyers/ })).toBeNull();

    const items = await screen.findAllByRole('heading', { level: 4 });
    // in the governorate and available first (rated best, then by distance), the closed one, the other governorate last
    expect(items.map((h) => h.textContent)).toEqual(['Far but proven', 'Third', 'Fourth']);
    expect(await screen.findByText('4.8')).toBeInTheDocument(); // its real rating, with the count
    expect(screen.getByText('(30)')).toBeInTheDocument();
    expect(screen.getAllByText(/from the property/).length).toBe(3);
    expect(screen.getByText(/Best first/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show 2 more' }));
    expect((await screen.findAllByRole('heading', { level: 4 })).map((h) => h.textContent)).toEqual([
      'Far but proven',
      'Third',
      'Fourth',
      'Near but closed',
      'Near but in Nablus',
    ]);
    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(3);
  });

  it('switches type, and says plainly when nobody is in the property\'s governorate', async () => {
    layers.real_estate_valuers = [at(4, { id: 9, name: 'Valuer in Nablus', gov_a: 'نابلس' })];
    const user = userEvent.setup();
    renderCard();
    await user.click(await screen.findByRole('button', { name: /Services for this land/ }));
    expect(screen.queryByText(/Nobody in the property/)).toBeNull();
    await user.click(screen.getByRole('tab', { name: /Real-estate valuers/ }));
    expect(await screen.findByText('Valuer in Nablus')).toBeInTheDocument();
    expect(screen.getByText(/Nobody in the property's governorate yet/)).toBeInTheDocument();
  });

  it('measures opening under its own source, once per opening, for signed-in people only', async () => {
    const user = userEvent.setup();
    renderCard();
    const header = await screen.findByRole('button', { name: /Services for this land/ });
    await user.click(header);
    expect(logged()).toEqual([
      { event_type: 'property_services_open', provider: null, service: 'الأراضي للبيع', source: 'property_services' },
    ]);
    await user.click(header); // closing is not an event
    expect(logged()).toHaveLength(1);
  });

  it('visitors browse it too; nothing is sent for them', async () => {
    useAuthStore.setState({ user: null });
    const user = userEvent.setup();
    renderCard();
    await user.click(await screen.findByRole('button', { name: /Services for this land/ }));
    expect(await screen.findAllByRole('heading', { level: 4 })).toHaveLength(3);
    expect(logged()).toEqual([]);
  });

  it('follows what the admin saved: other types, other order, unknown ones ignored', async () => {
    saved = JSON.stringify({ land: ['real_estate_valuers', 'nope', 'land_surveyors'] });
    const user = userEvent.setup();
    renderCard();
    const header = await screen.findByRole('button', { name: /Services for this land/ });
    expect(within(header).getByText('Real-estate valuers · Land surveyors')).toBeInTheDocument();
    await user.click(header);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      expect.stringContaining('Real-estate valuers (1)'),
      expect.stringContaining('Land surveyors (5)'),
    ]);
  });

  it('a type that fails to load is left out; the others stay', async () => {
    const real = backend;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('layer=land_surveyors')) return Promise.resolve(new Response('{}', { status: 500 }));
        return Promise.resolve(new Response(JSON.stringify(real(url)), { status: 200 }));
      }),
    );
    renderCard();
    const header = await screen.findByRole('button', { name: /Services for this land/ });
    expect(within(header).getByText('Real-estate valuers')).toBeInTheDocument();
  });
});
