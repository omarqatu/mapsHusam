import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformContentApi, platformContentKeys } from '@/api/platformContent';
import { CONTACT_KEY, DEFAULT_CONTACT, parseContact, serializeContact, type PlatformContact } from './model';

/** The platform's contact details for every page (public read, refreshed every 10 minutes). */
export function usePlatformContactQuery() {
  return useQuery({
    queryKey: platformContentKeys.item(CONTACT_KEY),
    queryFn: async () => {
      const res = await platformContentApi.get(CONTACT_KEY);
      return { contact: parseContact(res.item?.content_value), updatedAt: res.item?.updated_at ?? null };
    },
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

/** Saved contact details, or the default while loading / when the read failed. */
export function usePlatformContact(): PlatformContact {
  return usePlatformContactQuery().data?.contact ?? DEFAULT_CONTACT;
}

export function useSaveContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: PlatformContact) =>
      platformContentApi.save(CONTACT_KEY, 'Platform contact', serializeContact(c)),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformContentKeys.item(CONTACT_KEY) }),
  });
}
