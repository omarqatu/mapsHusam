import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import i18n from '@/i18n';
import type { AuthUser } from '@/types/auth';
import { useAuthStore } from '@/store/authStore';
import { ALL_TARGETS, targetKey, type MapTarget } from '../map/targets';
import PropertyServices from './PropertyServices';

// The contact buttons have their own tests; here only what this card does with them (measure) matters.
vi.mock('../map/search/ResultContact', () => ({
  default: ({
    onContact,
    onRequest,
  }: {
    onContact?: (c: 'call' | 'whatsapp') => void;
    onRequest?: () => void;
  }): ReactNode => (
    <>
      <button onClick={() => onContact?.('whatsapp')}>stub-whatsapp</button>
      <button onClick={() => onRequest?.()}>stub-request</button>
    </>
  ),
}));

// "Services for this land": the collapsed line, the search around the property (widening only when there are few), the
// order, and what is measured.

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
  at(1, { id: 1, name: 'One km, other governorate', gov_a: 'نابلس' }),
  at(8, { id: 2, name: 'Eight km, proven' }),
  at(2, { id: 3, name: 'Two km, closed now', auto_status: 1 }),
  at(3, { id: 4, name: 'Three km' }),
  at(6, { id: 5, name: 'Six km' }),
];
const VALUERS = [at(4, { id: 9, name: 'The valuer' })];

let calls: { url: string; body?: string }[] = [];
let layers: Record<string, ReturnType<typeof at>[]> = {};
let saved: string | null = null;
let propertyCount = 0;

/** The server's search, as far as this card uses it: a box around the point, or one governorate. */
function search(params: URLSearchParams) {
  let rows = layers[params.get('layer') ?? ''] ?? [];
  const bbox = params.get('bbox');
  if (bbox) {
    const [x0, y0, x1, y1] = bbox.split(',').map(Number);
    rows = rows.filter((f) => {
      const [x, y] = f.geometry.coordinates;
      return x >= x0 && x <= x1 && y >= y0 && y <= y1;
    });
  }
  if (params.get('field_0') === 'gov_a') rows = rows.filter((f) => f.properties.gov_a === params.get('value_0'));
  return fc(rows);
}

function backend(url: string): unknown {
  const u = new URL(url, 'http://x');
  const p = u.searchParams;
  if (u.pathname === '/api/platform-content/settings.propertyServices')
    return { success: true, item: saved ? { content_key: 'k', label: 'l', content_value: saved, updated_at: '' } : null };
  if (u.pathname === '/api/search-features') return search(p);
  if (u.pathname === '/api/service-ratings-summary')
    return {
      success: true,
      items: p.get('service_layer') === 'land_surveyors' ? [{ feature_id: 2, avg_rating: '4.8', total_ratings: 30 }] : [],
    };
  if (u.pathname === '/api/property-services-events') return { success: true };
  throw new Error(`unexpected request ${url}`);
}

/** Each test gets its own property id: "once per tab and property" events must not leak between tests. */
function renderCard(options: { target?: MapTarget; propertyId?: string | null; props?: Record<string, unknown> } = {}) {
  const propertyId = options.propertyId === undefined ? String(++propertyCount) : options.propertyId;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PropertyServices
          target={options.target ?? land}
          propertyId={propertyId}
          origin={ORIGIN}
          props={options.props ?? { gov_a: GOV }}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...ui, propertyId };
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

const tracked = () =>
  calls.filter((c) => c.url === '/api/property-services-events').map((c) => JSON.parse(c.body ?? '{}') as Record<string, unknown>);
const searches = (layer: string) =>
  calls.filter((c) => c.url.startsWith('/api/search-features') && c.url.includes(`layer=${layer}`)).map((c) => new URL(c.url, 'http://x').searchParams);
const names = () => screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
const openIt = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(await screen.findByRole('button', { name: /Services for this land/ }));

describe('PropertyServices — what it shows', () => {
  it('is one quiet line until asked, listing only the types somebody offers', async () => {
    renderCard();
    const header = await screen.findByRole('button', { name: /Services for this land/ });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(within(header).getByText('Land surveyors · Real-estate valuers')).toBeInTheDocument(); // lawyers: nobody yet
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('shows nothing for a property kind with no services, and when no type has anyone', async () => {
    const { unmount } = renderCard({ target: flat });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: /Services for/ })).toBeNull();
    unmount();
    layers = { land_surveyors: [], real_estate_valuers: [], lawyers: [] };
    renderCard();
    await waitFor(() => expect(searches('lawyers').length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: /Services for/ })).toBeNull();
  });

  it('opens on tabs with counts; ordered by active, trusted rating, then distance — not by governorate', async () => {
    const user = userEvent.setup();
    renderCard();
    await openIt(user);
    expect(screen.getByRole('tab', { name: /Land surveyors \(5\)/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Real-estate valuers \(1\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Lawyers/ })).toBeNull();

    await screen.findAllByRole('heading', { level: 4 });
    // proven rating first; then the unrated ones by distance — the 1 km one in another governorate is NOT held back; closed last
    expect(names()).toEqual(['Eight km, proven', 'One km, other governorate', 'Three km']);
    expect(await screen.findByText('4.8')).toBeInTheDocument(); // its real rating, with the count
    expect(screen.getByText('(30)')).toBeInTheDocument();
    expect(screen.getAllByText(/from the property/).length).toBe(3);
    expect(screen.getByText('Within 10 km of the property')).toBeInTheDocument();
    expect(screen.getByText(/Best first: active, then best rated, then nearest/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show 2 more' }));
    expect(names()).toEqual(['Eight km, proven', 'One km, other governorate', 'Three km', 'Six km', 'Two km, closed now']);
    // closed right now is information, in plain muted words — not a red warning
    expect(screen.getByText('Closed now')).not.toHaveStyle({ color: 'var(--color-danger)' });
    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(3);
  });

  it('switches type', async () => {
    const user = userEvent.setup();
    renderCard();
    await openIt(user);
    await user.click(screen.getByRole('tab', { name: /Real-estate valuers/ }));
    expect(await screen.findByText('The valuer')).toBeInTheDocument();
  });

  it('follows what the admin saved: stable type keys, other order, unknown ones ignored', async () => {
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

describe('PropertyServices — the search around the property', () => {
  it('asks the server for a box around the property\'s point, and stops there when it finds enough', async () => {
    renderCard();
    await screen.findByRole('button', { name: /Services for this land/ });
    const first = searches('land_surveyors');
    expect(first).toHaveLength(1); // 5 within 10 km: no widening
    expect(first[0].get('bbox')).toBe('160000,135000,180000,155000');
    expect(first[0].get('field_0')).toBeNull(); // the governorate is not asked for
  });

  it('cuts the box to a real circle: a corner of the square is not "within 10 km"', async () => {
    // 9 km east and 9 km north is inside the box but 12.7 km away
    layers.land_surveyors = [
      { ...at(0, { id: 1, name: 'Corner' }), geometry: { type: 'Point', coordinates: [ORIGIN[0] + 9000, ORIGIN[1] + 9000] } },
      at(2, { id: 2, name: 'A' }),
      at(3, { id: 3, name: 'B' }),
      at(4, { id: 4, name: 'C' }),
    ];
    const user = userEvent.setup();
    renderCard();
    await openIt(user);
    expect(screen.getByRole('tab', { name: /Land surveyors \(3\)/ })).toBeInTheDocument(); // not 4
    expect(names()).not.toContain('Corner');
  });

  it('widens step by step while there are few, and says so', async () => {
    layers.lawyers = [at(5, { id: 31, name: 'L5' }), at(15, { id: 32, name: 'L15' }), at(20, { id: 33, name: 'L20' })];
    const user = userEvent.setup();
    renderCard();
    await openIt(user);
    await user.click(screen.getByRole('tab', { name: /Lawyers \(3\)/ }));
    expect(screen.getByText('Nobody within 10 km — we widened the search to 25 km.')).toBeInTheDocument();
    expect(names()).toEqual(['L5', 'L15', 'L20']);
    expect(searches('lawyers').map((p) => p.get('bbox'))).toEqual([
      '160000,135000,180000,155000',
      '145000,120000,195000,170000',
    ]);
  });

  it('uses the governorate only as the last resort, and says so', async () => {
    layers.real_estate_valuers = [
      at(4, { id: 9, name: 'Near valuer' }),
      at(70, { id: 10, name: 'Valuer 70 km, same governorate' }),
      at(72, { id: 11, name: 'Valuer 72 km, other governorate', gov_a: 'الخليل' }),
    ];
    const user = userEvent.setup();
    renderCard();
    await openIt(user);
    await user.click(screen.getByRole('tab', { name: /Real-estate valuers \(2\)/ })); // 1 near + the governorate's one
    expect(screen.getByText('Nobody within 50 km — these are from the property\'s governorate.')).toBeInTheDocument();
    expect(names()).toEqual(['Near valuer', 'Valuer 70 km, same governorate']);
    const asked = searches('real_estate_valuers');
    expect(asked.map((p) => p.get('bbox'))).toEqual([
      '160000,135000,180000,155000',
      '145000,120000,195000,170000',
      '120000,95000,220000,195000',
      null, // then the governorate
    ]);
    expect(asked[3].get('field_0')).toBe('gov_a');
  });

  it('without a governorate on the property there is no fallback to ask', async () => {
    layers.real_estate_valuers = [at(4, { id: 9, name: 'Near valuer' })];
    renderCard({ props: {} });
    await screen.findByRole('button', { name: /Services for this land/ });
    await waitFor(() => expect(searches('real_estate_valuers')).toHaveLength(3));
    expect(searches('real_estate_valuers').every((p) => p.get('field_0') === null)).toBe(true);
  });
});

describe('PropertyServices — what is measured', () => {
  it('the card is seen once, with how many types had somebody; looking at a type once; closing is nothing', async () => {
    const user = userEvent.setup();
    const { propertyId } = renderCard();
    const header = await screen.findByRole('button', { name: /Services for this land/ });
    await waitFor(() => expect(tracked()).toHaveLength(1));
    expect(tracked()[0]).toMatchObject({
      action: 'view',
      property_layer: 'LandSale',
      property_id: propertyId,
      types_offered: 2,
    });
    expect(String(tracked()[0].visitor)).toMatch(/^guest-/);

    await user.click(header);
    await waitFor(() => expect(tracked()).toHaveLength(2));
    expect(tracked()[1]).toMatchObject({ action: 'open', service_type: 'land_surveyors', property_id: propertyId });
    await user.click(header); // close
    await user.click(header); // open again: the same type is not counted twice
    await user.click(screen.getByRole('tab', { name: /Real-estate valuers/ }));
    await waitFor(() => expect(tracked()).toHaveLength(3));
    expect(tracked()[2]).toMatchObject({ action: 'open', service_type: 'real_estate_valuers' });
  });

  it('a contact carries the property, the type, the provider and the channel; a request the same without a channel', async () => {
    const user = userEvent.setup();
    const { propertyId } = renderCard();
    await openIt(user);
    await screen.findAllByRole('heading', { level: 4 });
    await user.click(screen.getAllByText('stub-whatsapp')[0]); // the first row: "Eight km, proven" (provider 2)
    await user.click(screen.getAllByText('stub-request')[0]);
    await waitFor(() => expect(tracked().filter((e) => e.action === 'contact' || e.action === 'request')).toHaveLength(2));
    expect(tracked().find((e) => e.action === 'contact')).toMatchObject({
      property_layer: 'LandSale',
      property_id: propertyId,
      service_type: 'land_surveyors',
      provider_id: '2',
      channel: 'whatsapp',
    });
    const request = tracked().find((e) => e.action === 'request')!;
    expect(request).toMatchObject({ service_type: 'land_surveyors', provider_id: '2', property_id: propertyId });
    expect(request).not.toHaveProperty('channel');
  });

  it('visitors are counted too (the endpoint is public), and nothing is sent without a property id', async () => {
    useAuthStore.setState({ user: null });
    const user = userEvent.setup();
    renderCard();
    await openIt(user);
    await waitFor(() => expect(tracked().map((e) => e.action)).toEqual(['view', 'open']));
    const { unmount } = renderCard({ propertyId: null });
    await openIt(user);
    await new Promise((r) => setTimeout(r, 50));
    expect(tracked()).toHaveLength(2);
    unmount();
  });
});
