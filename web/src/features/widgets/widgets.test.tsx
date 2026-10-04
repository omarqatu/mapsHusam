import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';
import i18n from '@/i18n';
import { CITIES } from './model';
import TickerBar from './components/TickerBar';
import WidgetsPortalPage from './WidgetsPortalPage';

// Fake backend + fake third parties (the real ones are covered by widgets.live.test.ts).
const EVIL = '<img src=x onerror=alert(1)>';
let groups: Record<string, unknown> = {};
let weatherFails = false;
let requests: string[] = [];

const block = (max: number) => ({
  daily: {
    time: ['2026-09-29', '2026-09-30', '2026-10-01'],
    temperature_2m_max: [max, max, max],
    temperature_2m_min: [10, 10, 10],
    weathercode: [0, 3, 61],
  },
});

function respond(url: string): Response {
  requests.push(url);
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith('/api/widgets-data'))
    return json({ success: true, groups, road_status_updated_at: null, fuel_status_updated_at: null });
  if (url.startsWith('https://api.open-meteo.com'))
    return weatherFails ? new Response('no', { status: 500 }) : json(CITIES.map((_, i) => block(20 + i)));
  if (url.startsWith('https://api.aladhan.com'))
    return json({
      data: {
        timings: {
          Fajr: '04:00',
          Sunrise: '05:00',
          Dhuhr: '12:00',
          Asr: '15:00',
          Maghrib: '18:00',
          Isha: '19:00',
        },
      },
    });
  if (url.startsWith('/api/search-features')) return json({ type: 'FeatureCollection', features: [] });
  throw new Error(`unexpected request ${url}`);
}

function renderWith(ui: ReactElement, at = '/widgets/portal') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[at]}>{ui}</MemoryRouter>
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
  groups = {
    currency: {
      items: [{ id: 'c1', label: EVIL, code: 'USD/ILS', value: '3.01' }],
      updated_at: new Date().toISOString(),
    },
    gold: { items: [{ id: 'g1', label: 'Gold 24', value: '216', unit: 'ILS/g' }], updated_at: null },
    fuel: {
      items: Array.from({ length: 9 }, (_, i) => ({ id: `f${i}`, label: `Fuel ${i}`, value: String(i) })),
      updated_at: null,
    },
    weather: {
      items: [{ id: 'gaza', label: 'Gaza', temp: '31', humidity: '70', wind: '12', condition: 'Sunny' }],
      updated_at: null,
    },
    events: {
      items: [
        { id: 'e1', label: 'Old feast', date: '2020-01-01' },
        { id: 'e2', label: 'Future feast', date: '2999-01-01', notes: 'three days' },
      ],
      updated_at: null,
    },
  };
  weatherFails = false;
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => Promise.resolve(respond(String(input)))),
  );
});

describe('portal page', () => {
  it('shows the price cards with their rows, renders text (not markup) and the empty state of a group nobody saved', async () => {
    const { container } = renderWith(<WidgetsPortalPage />);
    expect(await screen.findByText(EVIL)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('3.01')).toBeInTheDocument();
    expect(screen.getByText('Gold 24')).toBeInTheDocument();
    // transport groups were never saved: an empty card, not made-up prices
    expect(screen.getAllByText('Nothing here yet').length).toBeGreaterThanOrEqual(2);
  });

  it('shows six rows of a long list, "show all" reveals the rest, and the search box filters every row', async () => {
    const user = userEvent.setup();
    renderWith(<WidgetsPortalPage />);
    expect(await screen.findByText('Fuel 0')).toBeInTheDocument();
    expect(screen.queryByText('Fuel 8')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show all (9)' }));
    expect(screen.getByText('Fuel 8')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Search by name...'), 'fuel 7');
    await waitFor(() => expect(screen.queryByText('Fuel 8')).toBeNull());
    expect(screen.getByText('Fuel 7')).toBeInTheDocument();
  });

  it('opens the tab of a deep-linked card and shows the admin weather next to the forecast, prayers and events', async () => {
    renderWith(<WidgetsPortalPage />, '/widgets/portal?card=prayer');
    expect(screen.getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('04:00')).toBeInTheDocument(); // Fajr
    expect(screen.getByText(/Next prayer:/)).toBeInTheDocument(); // which one depends on the clock
    // admin city first, with its "now" values; the forecast cities follow
    const gaza = (await screen.findByText('Gaza')).closest('li') as HTMLElement;
    expect(within(gaza).getByText('31°')).toBeInTheDocument();
    expect(within(gaza).getByText('Sunny')).toBeInTheDocument();
    expect(await screen.findByText('Ramallah')).toBeInTheDocument();
    // events: the future one listed, the past one folded away
    expect(screen.getByText('Future feast')).toBeInTheDocument();
    expect(screen.getByText('Past events (1)')).toBeInTheDocument();
  });

  it('keeps the saved weather and says so when the forecast service is down', async () => {
    weatherFails = true;
    renderWith(<WidgetsPortalPage />, '/widgets/portal?card=weather');
    expect(await screen.findByText('Gaza')).toBeInTheDocument();
    expect(await screen.findByText(/Could not load the forecast/)).toBeInTheDocument();
    expect(screen.queryByText('Ramallah')).toBeNull();
  });

  it('lists road and fuel status in the third tab', async () => {
    const user = userEvent.setup();
    renderWith(<WidgetsPortalPage />);
    await user.click(screen.getByRole('tab', { name: 'Roads & fuel' }));
    expect(await screen.findAllByText('No data right now')).toHaveLength(2);
    expect(requests.some((r) => r.includes('layer=road_barriers'))).toBe(true);
    expect(requests.some((r) => r.includes('layer=fuel_stations'))).toBe(true);
  });

  it('does not fetch the tabs it has not shown yet', async () => {
    renderWith(<WidgetsPortalPage />);
    await screen.findByText('3.01');
    expect(requests.some((r) => r.includes('search-features'))).toBe(false);
  });
});

describe('ticker', () => {
  it('links every item to its card of the portal and offers a pause button', async () => {
    renderWith(<TickerBar />, '/');
    const links = await screen.findAllByRole('link', { name: /USD\/ILS/ });
    expect(links[0]).toHaveAttribute('href', '/widgets/portal?card=currency');
    expect(screen.getAllByRole('link', { name: /Road status/ })[0]).toHaveAttribute(
      'href',
      '/widgets/portal?card=road-status',
    );
    const pause = screen.getByRole('button', { name: 'Pause scrolling' });
    await userEvent.click(pause);
    expect(screen.getByRole('button', { name: 'Resume scrolling' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides the duplicate copy of the loop from assistive technology', async () => {
    renderWith(<TickerBar />, '/');
    await screen.findAllByRole('link', { name: /USD\/ILS/ });
    // Only the first copy is exposed: one accessible "USD/ILS" link, one more in the aria-hidden copy.
    expect(screen.getAllByRole('link', { name: /USD\/ILS/ })).toHaveLength(1);
  });
});
