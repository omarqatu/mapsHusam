import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminStatsApi } from '@/api/adminStats';
import { toRow } from '../model';

export const statsKeys = { all: ['admin', 'provider-success-stats'] as const };

export function useSuccessStats() {
  return useQuery({
    queryKey: statsKeys.all,
    queryFn: async () => (await adminStatsApi.list()).stats.map(toRow),
    staleTime: 30_000,
  });
}

export function useDeleteStat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminStatsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: statsKeys.all }),
  });
}
