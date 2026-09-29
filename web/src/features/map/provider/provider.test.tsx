import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';
import ProviderPanel from './ProviderPanel';
import ProviderTracker from './ProviderTracker';
import { useProviderUi } from './store';

vi.mock('../geolocate', () => ({
  GeoError: class GeoError extends Error {
    messageKey = 'map.gps.denied';
  },
  locateOnce: vi.fn(),
}));
import { locateOnce } from '../geolocate';

type Body = Record<string, unknown>;
let serviceResponse: unknown;
let updateStatus = 200;
let updates: Body[] = [];

const linked = (over: Body = {}) => ({
  success: true,
  show_panel: true,
  user_status: 0,
  service: { service_layer: 'plumber', feature_id: 7, id: 7, status: 1, x_coord: '169000.5', y_coord: '145000.5' },
  ...over,
});

beforeAll(async () => {
  await i18n.changeLanguage('en');
});
afterAll(async () => {
  await i18n.changeLanguage('ar');
});
beforeEach(() => {
  updates = [];
  updateStatus = 200;
  serviceResponse = linked();
  vi.mocked(locateOnce).mockResolvedValue([170000.123, 146000.987]);
  useAuthStore.setState({ user: { user_id: 5, role: 'provider', full_name: 'Sami', token: 't' } as AuthUser });
  useProviderUi.setState({ open: true, live: false, cooldownUntil: 0, error: null });
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), 'http://x').pathname;
      if (path === '/api/get-provider-service')
        return Promise.resolve(new Response(JSON.stringify(serviceResponse), { status: 200 }));
      if (path === '/api/update-service-status') {
        updates.push(JSON.parse(String(init?.body)) as Body);
        const ok = updateStatus === 200;
        return Promise.resolve(
          new Response(JSON.stringify(ok ? { success: true, status: 0 } : { error: 'not yours' }), {
            status: updateStatus,
          }),
        );
      }
      // the feature name lookup
      return Promise.resolve(
        new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null, properties: { name: 'Ali <b>plumbing</b>' } }] }), { status: 200 }),
      );
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null });
});

const renderPanel = (extra = <></>) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ProviderPanel />
      {extra}
    </QueryClientProvider>,
  );

describe('ProviderPanel', () => {
  it('renders nothing for a non-provider', () => {
    useAuthStore.setState({ user: { user_id: 5, role: 'user', token: 't' } as AuthUser });
    renderPanel();
    expect(screen.queryByText('Manage my service')).toBeNull();
  });

  it('greets by name and shows the status and the feature name as text', async () => {
    renderPanel();
    expect(await screen.findByText('Welcome, Sami')).toBeInTheDocument();
    expect(await screen.findByText(/Your status: not available/)).toBeInTheDocument();
    expect(await screen.findByText('Ali <b>plumbing</b>')).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
  });

  it.each([
    ['not linked', { success: false, show_panel: false, message: 'no' }],
    ['frozen', linked({ user_status: 1 })],
  ])('%s account: one sentence and no buttons', async (_n, res) => {
    serviceResponse = res;
    renderPanel();
    expect(await screen.findByText(/do not have permission/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Available/ })).toBeNull();
  });

  it('"available (my location)" sends the GPS fix in grid metres (2 decimals), then locks for 10 s', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Available (my location)' }));
    await waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0]).toEqual({
      user_id: 5,
      service_layer: 'plumber',
      feature_id: 7,
      status: 0,
      x_coord: 170000.12,
      y_coord: 146000.99,
    });
    expect(await screen.findByText(/Your status: available/)).toBeInTheDocument();
    expect(screen.getByText(/Please wait \d+ s/)).toBeInTheDocument();
    for (const name of ['Available (my location)', 'Available (previous location)', 'Not available'])
      expect(screen.getByRole('button', { name })).toBeDisabled();
  });

  it('a GPS failure still sets the status, without coordinates', async () => {
    const { GeoError } = await import('../geolocate');
    vi.mocked(locateOnce).mockRejectedValue(new GeoError('map.gps.denied'));
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Available (my location)' }));
    await waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0]).not.toHaveProperty('x_coord');
    expect(updates[0].status).toBe(0);
  });

  it('"previous" and "busy" send only the status', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Available (previous location)' }));
    await waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0]).toMatchObject({ status: 0 });
    expect(updates[0]).not.toHaveProperty('x_coord');
    expect(locateOnce).not.toHaveBeenCalled();
    act(() => useProviderUi.setState({ cooldownUntil: 0 }));
    await user.click(screen.getByRole('button', { name: 'Not available' }));
    await waitFor(() => expect(updates).toHaveLength(2));
    expect(updates[1]).toMatchObject({ status: 1 });
  });

  it('a server refusal shows its message and does not lock the buttons', async () => {
    updateStatus = 403;
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Available (previous location)' }));
    expect(await screen.findByText('not yours')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not available' })).toBeEnabled();
    expect(screen.queryByText(/Please wait/)).toBeNull();
  });

  it('live tracking sends the position every 10 s and stops when toggled off', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    try {
      renderPanel(<ProviderTracker />);
      await screen.findByText('Welcome, Sami');
      await user.click(await screen.findByRole('button', { name: /Live tracking/ }));
      await waitFor(() => expect(updates).toHaveLength(1));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      await waitFor(() => expect(updates).toHaveLength(2));
      await user.click(screen.getByRole('button', { name: 'Stop live tracking' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(updates).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
    // ticks never start the 10 s lock
    expect(useProviderUi.getState().cooldownUntil).toBe(0);
  });
});
