import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';
import i18n from '@/i18n';
import type { MyListing } from '@/api/myListings';
import type { MyRelation, PublicRelation } from '@/api/propertyRelations';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';
import { ALL_TARGETS, targetKey, type MapTarget } from '../map/targets';
import AdminRelationsPage from './AdminRelationsPage';
import { listing, relation } from './fixtures';
import PropertyRelations from './PropertyRelations';
import RelationsManager from './RelationsManager';

// The card's "who worked on this land", the owner's / provider's manager in "My listings", and the admin's page.

const land = ALL_TARGETS.find((t) => targetKey(t) === 'land') as MapTarget;
const flat = ALL_TARGETS.find((t) => targetKey(t) === 'rent') as MapTarget;

let calls: { method: string; url: string; body?: unknown }[] = [];
let accepted: PublicRelation[] = [];
let mine: MyRelation[] = [];
let myListings: MyListing[] = [];
let providers: unknown[] = [];

const fc = (features: unknown[]) => ({ type: 'FeatureCollection', features });
const feature = (id: number, name: string, village: string) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [170000, 145000] },
  properties: { id, name, village_a: village, gov_a: 'رام الله والبيرة', auto_status: 0 },
});

function backend(method: string, url: string, body: unknown): unknown {
  const u = new URL(url, 'http://x');
  if (method === 'GET' && u.pathname === '/api/property-relations') return { success: true, items: accepted };
  if (method === 'GET' && u.pathname === '/api/my-property-relations') return { success: true, items: mine };
  if (method === 'GET' && u.pathname === '/api/my-listings') return { success: true, listings: myListings };
  if (method === 'GET' && u.pathname === '/api/search-features') return fc(providers);
  if (method === 'POST' && u.pathname === '/api/property-relations') {
    const b = body as { relation: MyRelation['relation']; property_id: number | string; provider_id: number | string; provider_layer: string };
    mine = [
      ...mine,
      relation({ id: 90, relation: b.relation, property_id: Number(b.property_id), provider_id: Number(b.provider_id), provider_layer: b.provider_layer, status: 'pending', i_asked: true, can_revoke: true }),
    ];
    return { success: true, id: 90, status: 'pending', waiting_for: 'property' };
  }
  const m = /^\/api\/property-relations\/(\d+)\/(respond|revoke)$/.exec(u.pathname);
  if (method === 'POST' && m) {
    const id = Number(m[1]);
    const accept = m[2] === 'respond' && (body as { accept: boolean }).accept;
    mine = mine.map((r) => (r.id === id ? { ...r, status: accept ? 'accepted' : 'revoked', can_answer: false, waiting_for: null } : r));
    return { success: true, status: accept ? 'accepted' : 'revoked' };
  }
  throw new Error(`unexpected ${method} ${url}`);
}

function renderUi(ui: ReactElement) {
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
  accepted = [];
  mine = [];
  myListings = [];
  providers = [];
  useAuthStore.setState({ user: null });
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, url: String(input), body });
      return Promise.resolve(new Response(JSON.stringify(backend(method, String(input), body)), { status: 200 }));
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null });
});

const signIn = (role: AuthUser['role']) => useAuthStore.setState({ user: { user_id: 2, token: 't', role } as AuthUser });
const posts = () => calls.filter((c) => c.method === 'POST');

describe('the card: who worked on this land', () => {
  const surveyedBy = (name: string): PublicRelation => ({
    id: 1,
    relation: 'surveyed_by',
    provider_layer: 'land_surveyors',
    provider_id: 2,
    provider_name: name,
    accepted_at: '2026-10-05T10:00:00Z',
  });

  it('shows who the two sides agreed on, as their statement; asks for the right property', async () => {
    accepted = [surveyedBy('م. خالد للمساحة')];
    renderUi(<PropertyRelations target={land} propertyId="1" />);
    expect(await screen.findByText('Who worked on this land')).toBeInTheDocument();
    expect(screen.getByText('م. خالد للمساحة')).toBeInTheDocument();
    expect(screen.getByText('Survey')).toBeInTheDocument();
    expect(screen.getByText(/their statement, not a guarantee from the platform/)).toBeInTheDocument();
    expect(calls.find((c) => c.url.startsWith('/api/property-relations'))?.url).toBe(
      '/api/property-relations?property_layer=LandSale&property_id=1',
    );
    // a visitor sees no way to claim, and asks nothing about their own links
    expect(screen.queryByRole('button')).toBeNull();
    expect(calls.some((c) => c.url.includes('my-property-relations'))).toBe(false);
  });

  it('shows nothing when there is nothing to say, and nothing on a flat', async () => {
    const { unmount } = renderUi(<PropertyRelations target={land} propertyId="1" />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('Who worked on this land')).toBeNull();
    unmount();
    accepted = [surveyedBy('x')];
    renderUi(<PropertyRelations target={flat} propertyId="1" />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('Who worked on this land')).toBeNull();
    expect(calls.filter((c) => c.url.startsWith('/api/property-relations?')).length).toBe(1); // only the land's, never the flat's
  });

  it('a provider can say "I surveyed this land"; it waits for the other side, and then shows as waiting', async () => {
    signIn('provider');
    myListings = [listing({}), listing({ layer: 'plumber', id: 9, name: 'سباك' })];
    const user = userEvent.setup();
    renderUi(<PropertyRelations target={land} propertyId="1" />);
    await user.click(await screen.findByRole('button', { name: 'I surveyed this land' }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toEqual({
      property_layer: 'LandSale',
      property_id: '1',
      relation: 'surveyed_by',
      provider_layer: 'land_surveyors',
      provider_id: 2,
    });
    expect(await screen.findByText(/Your request \(Survey — م. خالد للمساحة\) is waiting for the other side/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'I surveyed this land' })).toBeNull(); // not twice
  });

  it('a provider with several matching listings sees which one each button is for', async () => {
    signIn('provider');
    myListings = [listing({}), listing({ id: 3, name: 'مكتب الأرض' })];
    renderUi(<PropertyRelations target={land} propertyId="1" />);
    expect(await screen.findByRole('button', { name: 'I surveyed this land — م. خالد للمساحة' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I surveyed this land — مكتب الأرض' })).toBeInTheDocument();
  });
});

describe('My listings: the relations of a listing', () => {
  const land1 = listing({ layer: 'LandSale', id: 1, kind: 'property', name: 'قطعة 12 حوض 5' });

  it('a property: who was named and what each is waiting for; accept / decline / withdraw / end', async () => {
    signIn('provider');
    mine = [
      relation({ id: 1, provider_name: 'م. خالد للمساحة', waiting_for: 'provider', i_asked: true, can_revoke: true }),
      relation({ id: 2, relation: 'valued_by', provider_layer: 'real_estate_valuers', provider_id: 4, provider_name: 'مخمّن سامر', waiting_for: 'property', can_answer: true, can_revoke: false }),
      relation({ id: 3, provider_name: 'مكتب الأرض', provider_id: 3, status: 'accepted', waiting_for: null, can_revoke: true }),
      relation({ id: 4, provider_name: 'قديم', status: 'revoked', waiting_for: null }),
      relation({ id: 5, property_id: 77, provider_name: 'لعقار آخر' }),
    ];
    const user = userEvent.setup();
    renderUi(<RelationsManager listing={land1} />);
    expect(await screen.findByText('م. خالد للمساحة')).toBeInTheDocument();
    expect(screen.queryByText('قديم')).toBeNull(); // ended ones are not listed
    expect(screen.queryByText('لعقار آخر')).toBeNull(); // another property's
    const rowOf = (name: string) => screen.getByText(name).closest('li') as HTMLElement;
    expect(within(rowOf('م. خالد للمساحة')).getByText('Waiting for the provider')).toBeInTheDocument();
    expect(within(rowOf('مخمّن سامر')).getByText('Waiting for the owner')).toBeInTheDocument();
    expect(within(rowOf('مكتب الأرض')).getByText('Agreed')).toBeInTheDocument();

    // the valuer asked: the owner answers
    await user.click(within(rowOf('مخمّن سامر')).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(within(rowOf('مخمّن سامر')).getByText('Agreed')).toBeInTheDocument());
    expect(posts().at(-1)).toMatchObject({ url: '/api/property-relations/2/respond', body: { accept: true } });
    // my own request: withdraw at once
    await user.click(within(rowOf('م. خالد للمساحة')).getByRole('button', { name: 'Withdraw the request' }));
    await waitFor(() => expect(screen.queryByText('م. خالد للمساحة')).toBeNull());
    expect(posts().at(-1)?.url).toBe('/api/property-relations/1/revoke');
    // an agreed one: ending asks first
    await user.click(within(rowOf('مكتب الأرض')).getByRole('button', { name: 'End the link' }));
    expect(posts().filter((c) => c.url.endsWith('/3/revoke'))).toHaveLength(0);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'End the link' }));
    await waitFor(() => expect(posts().some((c) => c.url === '/api/property-relations/3/revoke')).toBe(true));
  });

  it('a decline is one tap', async () => {
    signIn('provider');
    mine = [relation({ id: 2, waiting_for: 'property', can_answer: true })];
    const user = userEvent.setup();
    renderUi(<RelationsManager listing={land1} />);
    await user.click(await screen.findByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(posts().at(-1)).toMatchObject({ url: '/api/property-relations/2/respond', body: { accept: false } }));
  });

  it('the owner names a surveyor: search by name, one tap to ask', async () => {
    signIn('provider');
    providers = [feature(2, 'م. خالد للمساحة', 'رام الله'), feature(3, 'مكتب الأرض', 'نابلس')];
    const user = userEvent.setup();
    renderUi(<RelationsManager listing={land1} />);
    await user.click(await screen.findByRole('button', { name: 'Name a surveyor or valuer' }));
    expect(await screen.findByText('مكتب الأرض')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('layer=land_surveyors'))).toBe(true);
    await user.type(screen.getByRole('textbox', { name: 'Search by name' }), 'خالد');
    expect(screen.queryByText('مكتب الأرض')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ask to link' }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toEqual({ property_layer: 'LandSale', property_id: 1, relation: 'surveyed_by', provider_layer: 'land_surveyors', provider_id: '2' });
    // switching to valuers asks for that type
    await user.click(screen.getByRole('button', { name: 'Valuer' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('layer=real_estate_valuers'))).toBe(true));
  });

  it('a provider sees the properties that named them, and answers', async () => {
    signIn('provider');
    mine = [relation({ id: 1, waiting_for: 'provider', can_answer: true, property_name: 'قطعة 12 حوض 5' })];
    const user = userEvent.setup();
    renderUi(<RelationsManager listing={listing({})} />);
    expect(await screen.findByText('قطعة 12 حوض 5')).toBeInTheDocument(); // the property leads on a provider's page
    expect(screen.getByText(/open it on the map and tap "I surveyed this land"/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Name a surveyor or valuer' })).toBeNull(); // naming is the owner's
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(posts().at(-1)).toMatchObject({ url: '/api/property-relations/1/respond', body: { accept: true } }));
  });
});

describe('the admin page', () => {
  it('a claim on a plot nobody owns waits here; the admin approves it, and may end any link', async () => {
    signIn('admin');
    mine = [
      relation({ id: 1, property_has_owner: false, waiting_for: 'property', can_answer: true, can_revoke: true, property_name: 'قطعة 7 حوض 2' }),
      relation({ id: 2, status: 'accepted', waiting_for: null, can_revoke: true, property_name: 'قطعة 12 حوض 5', provider_name: 'مكتب الأرض' }),
      relation({ id: 3, status: 'revoked', waiting_for: null, property_name: 'قطعة منتهية' }),
    ];
    const user = userEvent.setup();
    renderUi(<AdminRelationsPage />);
    expect(await screen.findByText('قطعة 7 حوض 2')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pending (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Agreed (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ended (1)' })).toBeInTheDocument();
    expect(screen.getByText('Waiting for the admin')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(posts().at(-1)).toMatchObject({ url: '/api/property-relations/1/respond', body: { accept: true } }));
    await user.click(screen.getByRole('tab', { name: /Agreed/ }));
    expect(await screen.findByText('قطعة 12 حوض 5')).toBeInTheDocument();
    expect(screen.getByText('قطعة 7 حوض 2')).toBeInTheDocument(); // the one just approved joined the agreed ones
    expect(screen.getAllByRole('button', { name: 'End the link' })).toHaveLength(2);
  });
});
