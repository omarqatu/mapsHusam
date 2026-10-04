import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      // Never retry an answer the server already gave (4xx); retry once for network / 5xx.
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

/** GeoJSON results are huge nested arrays; structural sharing would deep-walk them on every refetch. */
export const geoQueryOptions = { structuralSharing: false } as const;
