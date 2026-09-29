import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import i18n from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser, Role } from '@/types/auth';
import HomePage from './HomePage';

// The page is checked against a stubbed fetch (fixed data per role, plus the failure the real server cannot produce on
// demand). The same hooks are exercised against the real backend in home.live.test.ts.

const UID = 10;
const sr = (over: Record<string, unknown>) => ({
  id: 1,
  user_id: UID,
  provider_user_id: 20,
  status: 'pending',
  contact_type: 'service_request',
  ...over,
});

interface Data {
  mine?: unknown[];
  incoming?: unknown[];
  users?: { user_id: number; is_active: boolean }[];
  providerStatus?: number;
  failMine?: boolean;
}

function stubServer(d: Data) {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://x');
      switch (url.pathname) {
        case '/api/service-requests':
          if (url.searchParams.has('provider_user_id')) return json({ success: true, requests: d.incoming ?? [] });
          return d.failMine ? json({ error: 'boom' }, 500) : json({ success: true, requests: d.mine ?? [] });
        case '/api/service-requests/pending-ratings':
          return json({ success: true, pendingRatings: [] });
        case '/api/service-ratings/pending-comments':
          return json({ success: true, pendingComments: [] });
        case '/api/platform-stats':
          return json({
            success: true,
            data: { usersTotal: 7, viewsTotal: 1234, servicesCount: 69, featuresCount: 388 },
          });
        case '/api/admin/users':
          return json({ success: true, users: d.users ?? [], onlineUserIds: [], total: d.users?.length ?? 0 });
        case '/api/get-provider-service':
          return json({
            success: true,
            show_panel: true,
            user_status: 0,
            service: { service_layer: 'plumber', feature_id: 14, id: 1, status: d.providerStatus ?? 0, x_coord: 1, y_coord: 1 },
          });
        default:
          return json({}, 404);
      }
    }),
  );
}

function SearchProbe() {
  return <p>search page {useLocation().search}</p>;
}

function renderHome(role: Role, d: Data = {}) {
  stubServer(d);
  useAuthStore.setState({
    user: { user_id: UID, id: UID, role, full_name: 'Sara Ahmad', phone: '0590000003', token: 't', admin_token: null } as AuthUser,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/search" element={<SearchProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cardTitles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
/** A card is found by its title (a span inside the link / button). */
const hasCard = (title: string) => !!screen.queryByText(title, { selector: 'span' });

describe('HomePage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });
  afterAll(async () => {
    await i18n.changeLanguage('ar');
  });
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({ user: null });
  });

  it('greets by first name with today\'s date and sends a search to /search?q=', async () => {
    renderHome('user');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Good (morning|afternoon|evening), Sara$/);
    expect(screen.getByRole('search')).toBeInTheDocument();
    const box = screen.getByRole('searchbox');

    // One letter is not enough (the search page needs two): a hint, no navigation.
    await userEvent.type(box, 'a{enter}');
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.clear(box);
    await userEvent.type(box, 'plumber shop{enter}');
    expect(await screen.findByText('search page ?q=plumber%20shop')).toBeInTheDocument();
  });

  it('shows a calm empty state when nothing is waiting', async () => {
    renderHome('user');
    expect(await screen.findByText('Nothing is waiting for you')).toBeInTheDocument();
    expect(screen.queryByText('Unread notifications')).toBeNull();
  });

  it('a user sees their own waiting requests and the everyday cards only', async () => {
    renderHome('user', {
      mine: [sr({ id: 1 }), sr({ id: 2, status: 'accepted' }), sr({ id: 3, status: 'completed' })],
    });
    const waiting = (await screen.findByText('Requests you sent, waiting for the provider')).closest('li')!;
    expect(within(waiting).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Chats in progress').closest('li')).toHaveTextContent('1');
    expect(screen.queryByText('Nothing is waiting for you')).toBeNull();

    for (const name of ['Interactive map', 'Search without a map', 'Live info', 'My requests', 'Notifications'])
      expect(hasCard(name)).toBe(true);
    for (const name of ['Manage my service', 'Users', 'Dashboard', 'Widgets admin']) expect(hasCard(name)).toBe(false);
    // Live figures from the platform counters.
    // ...on the map / search cards and again in the slim platform row.
    await waitFor(() => expect(screen.getAllByText('388')).toHaveLength(2));
    expect(screen.getAllByText('69')).toHaveLength(2);
  });

  it('a provider sees the incoming queue, the hidden-status notice and the service card', async () => {
    const incoming = [sr({ id: 5, user_id: 30, provider_user_id: UID }), sr({ id: 6, user_id: 31, provider_user_id: UID })];
    renderHome('provider', { mine: incoming, incoming, providerStatus: 1 });
    const row = (await screen.findByText('New service requests waiting for your answer')).closest('li')!;
    expect(within(row).getByText('2')).toBeInTheDocument();
    expect(await screen.findByText(/Your status is/)).toBeInTheDocument();
    expect(hasCard('Manage my service')).toBe(true);
    expect(await screen.findByText('Unavailable', { selector: 'span' })).toBeInTheDocument();
    expect(hasCard('Users')).toBe(false);
  });

  it('an available provider with an empty queue has nothing waiting', async () => {
    renderHome('provider', { providerStatus: 0 });
    expect(await screen.findByText('Nothing is waiting for you')).toBeInTheDocument();
    expect(await screen.findByText('Available', { selector: 'span' })).toBeInTheDocument();
  });

  it('an admin sees accounts awaiting activation and the admin cards', async () => {
    renderHome('admin', {
      users: [
        { user_id: 1, is_active: true },
        { user_id: 2, is_active: false },
        { user_id: 3, is_active: false },
      ],
    });
    const row = (await screen.findByText('Inactive accounts waiting for your review')).closest('li')!;
    expect(within(row).getByText('2')).toBeInTheDocument();
    expect(within(row).getByRole('link')).toHaveAttribute('href', '/admin/users');
    for (const name of ['Users', 'Dashboard', 'Widgets admin']) expect(hasCard(name)).toBe(true);
    expect(hasCard('Manage my service')).toBe(false);
    expect(cardTitles()).toContain('Needs you');
  });

  it('keeps the page usable and offers a retry when a call fails', async () => {
    renderHome('user', { failMine: true });
    expect(await screen.findByText('Some of the data could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    // The entrances are still there.
    expect(hasCard('Interactive map')).toBe(true);
    await waitFor(() => expect(screen.getAllByText('388')).toHaveLength(2));
  });
});
