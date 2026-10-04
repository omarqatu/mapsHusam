import { useQuery } from '@tanstack/react-query';
import { platformContentKeys } from '@/api/platformContent';
import { loadLegalDoc } from './content';
import { fetchOverride, overrideKey, type LegalOverride } from './overrides';
import type { LegalDoc, LegalKey } from './types';

/**
 * One legal text: the built-in document (a lazy chunk, cached for the session) and, when the admin has replaced it, the
 * replacement (`custom`, shown instead). While either is on its way `isLoading` is true, so the built-in text never
 * flashes before a replacement. If the replacement cannot be fetched the built-in text shows.
 */
export function useLegalDoc(key: LegalKey | null): {
  doc: LegalDoc | null;
  custom: LegalOverride | null;
  isLoading: boolean;
} {
  const q = useQuery({
    queryKey: ['legal-text', key],
    queryFn: () => loadLegalDoc(key as LegalKey),
    enabled: key !== null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const o = useQuery({
    queryKey: platformContentKeys.item(key ? overrideKey(key) : ''),
    queryFn: () => fetchOverride(overrideKey(key as LegalKey)),
    enabled: key !== null,
    staleTime: 5 * 60_000,
    retry: false, // on failure the built-in text shows at once
  });
  return { doc: q.data ?? null, custom: o.data ?? null, isLoading: q.isLoading || o.isLoading };
}
