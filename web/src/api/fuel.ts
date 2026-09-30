import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { LIVE_REFRESH_MS } from './market';

// GET /api/fuel-prices (server.js, public): the Palestinian retail fuel prices read from thefuelprice.com by the server
// (cached 6.5 min; a page that changed shape is refused there, so what arrives here has passed range checks).

export interface FuelPrice {
  /** Row id of the fuel group (`fuel-95`, `fuel-98`, `fuel-diesel`, `kas`, `fuel-gas-small5`, `fuel-gas-cylinder`, `fuel-gas-large`). */
  key: string;
  /** Shekels per litre or per cylinder. */
  value: number;
  /** The price before the last change (null when the source did not say). */
  previous: number | null;
  unit: 'liter' | 'cylinder';
  /** `YYYY-MM-DD` the current price started. */
  effectiveFrom: string | null;
}

export interface FuelPrices {
  items: FuelPrice[];
  /** Date the source says it last updated its prices. */
  sourceUpdatedOn: string | null;
  source: string;
  /** When our server last read the source. */
  fetchedAt: string;
}

export const fuelApi = {
  /** `fresh`: ask the server to read the source now instead of answering from its cache (it allows that once a minute). */
  prices: (fresh = false) =>
    api.get<{ success: boolean; data?: FuelPrices }>('/api/fuel-prices', fresh ? { fresh: '1' } : undefined),
};

export const fuelKeys = { prices: ['fuel-prices'] as const };

export async function readFuelPrices(fresh = false) {
  const res = await fuelApi.prices(fresh);
  if (!res.success || !res.data) throw new Error('fuel-prices');
  return res.data;
}

/** Fuel prices for the information centre; a failure leaves the admin's own fuel rows in place. */
export function useFuelPrices() {
  return useQuery({
    queryKey: fuelKeys.prices,
    queryFn: () => readFuelPrices(),
    staleTime: LIVE_REFRESH_MS,
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
