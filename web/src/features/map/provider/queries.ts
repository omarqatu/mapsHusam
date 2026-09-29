import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { providerApi, type ProviderServiceResponse, type ProviderStatus } from '@/api/provider';
import { searchApi } from '@/api/search';
import { useAuthStore } from '@/store/authStore';
import type { Coordinate } from '../config';
import { targetToApi, type MapTarget } from '../targets';
import { interpretService, type ProviderService } from './model';

export const providerKeys = {
  service: ['provider', 'service'] as const,
  feature: (layer: string, id: number) => ['provider', 'feature', layer, id] as const,
};

/** The UI gate: the panel exists only for provider accounts. The server re-checks on every call. */
export const useIsProvider = () => useAuthStore((s) => s.user?.role === 'provider');

/** The provider's linked feature and account state (linked / frozen / ready). */
export function useProviderAccount() {
  const isProvider = useIsProvider();
  return useQuery({
    queryKey: providerKeys.service,
    queryFn: providerApi.getService,
    enabled: isProvider,
    staleTime: 30_000,
    select: interpretService,
  });
}

interface StatusChange {
  service: ProviderService;
  status: ProviderStatus;
  /** Palestine Grid metres, when the position moves too. */
  location?: Coordinate;
}

/** Sets the status (and optionally the position). On success the cached service is patched — no refetch per tick. */
export function useSetProviderStatus() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.user_id);
  return useMutation({
    mutationFn: ({ service, status, location }: StatusChange) =>
      providerApi.updateStatus({
        user_id: userId!,
        service_layer: service.layer,
        feature_id: service.featureId,
        status,
        ...(location ? { x_coord: location[0], y_coord: location[1] } : {}),
      }),
    onSuccess: (_res, { status, location }) => {
      qc.setQueryData<ProviderServiceResponse>(providerKeys.service, (old) =>
        old && old.success
          ? {
              ...old,
              service: {
                ...old.service,
                status,
                ...(location ? { x_coord: location[0], y_coord: location[1] } : {}),
              },
            }
          : old,
      );
    },
  });
}

/** The linked feature's public row (name, hours…). Read through the public batch endpoint, which ignores `status`. */
export function useProviderFeature(target: MapTarget | null, featureId: number | undefined) {
  const api = target ? targetToApi(target) : null;
  return useQuery({
    queryKey: providerKeys.feature(api?.layer ?? '', featureId ?? 0),
    queryFn: ({ signal }) => searchApi.batch({ ...api!, ids: [featureId!] }, signal),
    enabled: !!api && featureId !== undefined,
    select: (fc) => fc.features[0]?.properties ?? null,
    structuralSharing: false,
  });
}
