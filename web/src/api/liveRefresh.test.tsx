import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRefreshAll } from '@/features/widgets/hooks/useWidgets';
import { fuelApi, useFuelPrices } from './fuel';
import { LIVE_REFRESH_MS, marketApi, useMarketRates } from './market';

// The live prices must keep updating by themselves while a page stays open: every 7 minutes, no reload.
// (Timers are faked; the endpoints themselves are exercised against the real server in liveUpdates.live.test.ts.)

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('live prices refresh on their own', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('reads every 7 minutes', () => expect(LIVE_REFRESH_MS).toBe(7 * 60_000));

  it('market rates are fetched again each 7 minutes, and not before', async () => {
    const spy = vi.spyOn(marketApi, 'rates').mockResolvedValue({
      success: true,
      data: { rates: null, gold: null, silver: null, updatedAt: '2026-09-30T00:00:00Z' },
    });
    const { unmount } = renderHook(() => useMarketRates(), { wrapper });
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(spy).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(LIVE_REFRESH_MS - 60_000));
    expect(spy).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(spy).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(LIVE_REFRESH_MS));
    expect(spy).toHaveBeenCalledTimes(3);
    unmount();
    spy.mockRestore();
  });

  it('fuel prices are fetched again each 7 minutes', async () => {
    const spy = vi.spyOn(fuelApi, 'prices').mockResolvedValue({
      success: true,
      data: { items: [], sourceUpdatedOn: null, source: 'x', fetchedAt: '2026-09-30T00:00:00Z' },
    });
    const { unmount } = renderHook(() => useFuelPrices(), { wrapper });
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(spy).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(LIVE_REFRESH_MS));
    expect(spy).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(LIVE_REFRESH_MS));
    expect(spy).toHaveBeenCalledTimes(3);
    unmount();
    spy.mockRestore();
  });

  it('"refresh all" asks the server to read the sources now (fresh), not to answer from its cache', async () => {
    const market = vi.spyOn(marketApi, 'rates').mockResolvedValue({
      success: true,
      data: { rates: null, gold: null, silver: null, updatedAt: '2026-09-30T00:00:00Z' },
    });
    const fuel = vi.spyOn(fuelApi, 'prices').mockResolvedValue({
      success: true,
      data: { items: [], sourceUpdatedOn: null, source: 'x', fetchedAt: '2026-09-30T00:00:00Z' },
    });
    const { result, unmount } = renderHook(() => useRefreshAll(), { wrapper });
    await act(async () => result.current.refresh());
    expect(market).toHaveBeenCalledWith(true);
    expect(fuel).toHaveBeenCalledWith(true);
    unmount();
    market.mockRestore();
    fuel.mockRestore();
  });
});
