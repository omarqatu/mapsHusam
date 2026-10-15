import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import i18n from '@/i18n';
import TodayStrip from './TodayStrip';

beforeAll(async () => {
  await i18n.changeLanguage('en');
});
afterAll(async () => {
  await i18n.changeLanguage('ar');
});
afterEach(() => vi.unstubAllGlobals());

function show(fuel: unknown) {
  // Every other source is down: only what the fuel answer gives is shown.
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input).includes('/api/fuel-prices')
          ? Response.json(fuel)
          : new Response('down', { status: 503 }),
      ),
    ),
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <TodayStrip />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const prices = (value: number) => ({
  success: true,
  data: {
    items: [
      { key: 'fuel-diesel', value: 6.1, previous: null, unit: 'liter', effectiveFrom: null },
      { key: 'fuel-95', value, previous: null, unit: 'liter', effectiveFrom: null },
    ],
    sourceUpdatedOn: null,
    source: 'x',
    fetchedAt: '2026-10-15T08:00:00Z',
  },
});

describe('the today strip', () => {
  it("shows today's petrol 95 price, linking to the fuel card", async () => {
    show(prices(7.24));
    const chip = await screen.findByRole('link', { name: /Petrol 95/ });
    expect(chip).toHaveTextContent('7.24');
    expect(chip).toHaveAttribute('href', '/widgets/portal?card=fuel');
  });

  it('leaves the price out when the source has none', async () => {
    show({ success: false });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('link', { name: /Petrol 95/ })).toBeNull();
  });
});
