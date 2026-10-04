import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminWidgetsApi, type WidgetGroupKey, type WidgetItem } from '@/api/adminWidgets';
import { liveStatusKeys } from '@/api/liveStatus';
import { toTextItem } from '../model';

export const adminWidgetKeys = {
  groups: ['admin', 'widgets-data'] as const,
  features: ['admin', 'road-fuel-features'] as const,
};

/** The seven hand-edited groups (rows as text). A group the server has never stored is simply absent. */
export function useWidgetGroups() {
  return useQuery({
    queryKey: adminWidgetKeys.groups,
    queryFn: async () => {
      const res = await adminWidgetsApi.groups();
      return Object.fromEntries(
        Object.entries(res.groups).map(([key, g]) => [
          key,
          { updatedAt: g?.updated_at ?? null, items: Array.isArray(g?.data) ? g.data.map(toTextItem) : [] },
        ]),
      ) as Partial<Record<WidgetGroupKey, { updatedAt: string | null; items: WidgetItem[] }>>;
    },
    staleTime: 30_000,
  });
}

export function useSaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { key: WidgetGroupKey; items: WidgetItem[] }) =>
      adminWidgetsApi.saveGroup(v.key, v.items),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminWidgetKeys.groups }),
  });
}

export function useFeatures() {
  return useQuery({
    queryKey: adminWidgetKeys.features,
    queryFn: adminWidgetsApi.features,
    staleTime: 30_000,
  });
}

/** After any road / fuel save the "last update" stamps of the public data change too. */
export function useRefreshStamps() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: liveStatusKeys.updatedAt });
}
