import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { platformContentApi, platformContentKeys } from '@/api/platformContent';
import {
  CONTACT_KEY,
  NO_CONTACT,
  parseContact,
  sameContact,
  serializeContact,
  type PlatformContact,
} from './model';

/** The platform's WhatsApp / phone. Public read (like the visibility and theme settings); `NO_CONTACT` until loaded. */
export function useContactQuery() {
  return useQuery({
    queryKey: platformContentKeys.item(CONTACT_KEY),
    queryFn: async () => {
      // An unsaved key is `item: null` (older servers: 404) — both mean "no numbers set yet".
      const res = await platformContentApi.get(CONTACT_KEY).catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) return { item: null };
        throw e;
      });
      return { contact: parseContact(res.item?.content_value), updatedAt: res.item?.updated_at ?? null };
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export const usePlatformContact = (): PlatformContact => useContactQuery().data?.contact ?? NO_CONTACT;

/** Save the numbers for everyone; saving two empty numbers removes the row. */
export function useSaveContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: PlatformContact) =>
      sameContact(c, NO_CONTACT)
        ? platformContentApi.remove(CONTACT_KEY)
        : platformContentApi.save(CONTACT_KEY, 'Platform contact', serializeContact(c)),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformContentKeys.item(CONTACT_KEY) }),
  });
}
