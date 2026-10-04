import { useQuery } from '@tanstack/react-query';
import { api } from './client';

// GET /api/market-rates (server.js, public): world exchange rates and the gold price, fetched and cached (10 min) by the
// server so a visitor's browser never talks to the third-party services. Each half is null when its source was down.

export interface MarketRates {
  /** Shekels per one unit; `asOf` = when the source published them (daily). */
  rates: { USD_ILS: number; JOD_ILS: number; EUR_ILS: number; asOf: string | null } | null;
  gold: {
    usdPerOunce: number;
    /** Null when the exchange rate was unavailable. */
    ilsPerGram24: number | null;
    ilsPerGram21: number | null;
    ilsPerGram18: number | null;
    asOf: string | null;
  } | null;
  silver: { usdPerOunce: number; asOf: string | null } | null;
  /** When our server last fetched. */
  updatedAt: string;
}

/**
 * How often the live prices (world market, fuel) are read again while a page is open: every 7 minutes, and at once when the tab
 * comes back after that long. The server's own cache lasts a little less (6.5 min), so every read reaches a fresh fetch.
 */
export const LIVE_REFRESH_MS = 7 * 60_000;

export const marketApi = {
  /** `fresh`: ask the server to read the sources now instead of answering from its cache (it allows that once a minute). */
  rates: (fresh = false) =>
    api.get<{ success: boolean; data?: MarketRates }>(
      '/api/market-rates',
      fresh ? { fresh: '1' } : undefined,
    ),
};

export const marketKeys = { rates: ['market-rates'] as const };

export async function readMarketRates(fresh = false) {
  const res = await marketApi.rates(fresh);
  if (!res.success || !res.data) throw new Error('market-rates');
  return res.data;
}

/** World rates for the landing strip; a failure just hides the prices (the admin's own price cards are unaffected). */
export function useMarketRates() {
  return useQuery({
    queryKey: marketKeys.rates,
    queryFn: () => readMarketRates(),
    staleTime: LIVE_REFRESH_MS,
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
