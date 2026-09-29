import { useQuery } from '@tanstack/react-query';
import { loadLegalDoc } from './content';
import type { LegalDoc, LegalKey } from './types';

/** One legal text, loaded on demand (a lazy chunk, not an HTTP call); cached for the rest of the session. */
export function useLegalDoc(key: LegalKey | null): { doc: LegalDoc | null; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['legal-text', key],
    queryFn: () => loadLegalDoc(key as LegalKey),
    enabled: key !== null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return { doc: q.data ?? null, isLoading: q.isLoading };
}
