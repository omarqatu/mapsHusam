import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformContentApi, platformContentKeys, type PlatformContentItem } from '@/api/platformContent';
import { backupKey, overrideKey, parseOverride, serializeOverride, type LegalOverride } from '@/features/legal/overrides';
import type { LegalKey } from '@/features/legal/types';

export interface TextState {
  /** The admin's replacement shown to visitors, with its last save. */
  custom: (LegalOverride & { updatedAt: string }) | null;
  /** The backup copy the admin saved (never shown to visitors). */
  backup: (LegalOverride & { updatedAt: string }) | null;
}

const withStamp = (item: PlatformContentItem | undefined) => {
  const o = item && parseOverride(item.content_value);
  return o ? { ...o, updatedAt: item.updated_at } : null;
};

/** Replacement + backup of every text, from one read of the whole table (admin page only). */
export function useTextStates() {
  return useQuery({
    queryKey: platformContentKeys.list,
    queryFn: async () => {
      const res = await platformContentApi.list();
      const byKey = new Map((res.items ?? []).map((i) => [i.content_key, i]));
      return (key: LegalKey): TextState => ({
        custom: withStamp(byKey.get(overrideKey(key))),
        backup: withStamp(byKey.get(backupKey(key))),
      });
    },
  });
}

type Action =
  | { kind: 'save'; key: LegalKey; text: LegalOverride }
  | { kind: 'backup'; key: LegalKey; text: LegalOverride }
  | { kind: 'restoreDefault'; key: LegalKey };

/** Save the replacement, save a backup copy, or go back to the built-in text. Every page picks the change up. */
export function useTextAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: Action) => {
      if (a.kind === 'restoreDefault') return platformContentApi.remove(overrideKey(a.key));
      const contentKey = a.kind === 'save' ? overrideKey(a.key) : backupKey(a.key);
      return platformContentApi.save(contentKey, a.text.title, serializeOverride(a.text));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: platformContentKeys.all }),
  });
}
