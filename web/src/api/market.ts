import { useQuery } from '@tanstack/react-query';
import { api } from './client';

// GET /api/market-rates (server.js, public): world exchange rates and the gold price, fetched and cached (10 min) by the
// server so a visitor's browser never talks to the third-party services. Each half is null when its source was down.

export interface MarketRates {
  /** Shekels per one unit. */
  rates: { USD_ILS: number; JOD_ILS: number; EUR_ILS: number } | null;
  gold: {
    usdPerOunce: number;
    /** Null when the exchange rate was unavailable. */
    ilsPerGram24: number | null;
    ilsPerGram21: number | null;
  } | null;
  updatedAt: string;
}

export const marketApi = {
  rates: () => api.get<{ success: boolean; data?: MarketRates }>('/api/market-rates'),
};

export const marketKeys = { rates: ['market-rates'] as const };

/** World rates for the landing strip; a failure just hides the prices (the admin's own price cards are unaffected). */
export function useMarketRates() {
  return useQuery({
    queryKey: marketKeys.rates,
    queryFn: async () => {
      const res = await marketApi.rates();
      if (!res.success || !res.data) throw new Error('market-rates');
      return res.data;
    },
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  });
}
