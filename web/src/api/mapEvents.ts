import { useQuery } from '@tanstack/react-query';
import { api } from './client';

// Endpoints used by the map popup (legacy js/popup.js + shared-utils.js). Shapes read from server.js.

export interface ServiceRating {
  rating: number;
  comment: string | null;
  created_at: string;
  user_name: string | null;
}
export interface ServiceRatingsResponse {
  success: boolean;
  ratings: ServiceRating[];
  averageRating: number;
  totalRatings: number;
}

/** POST /api/check-request-limit — per-user contact quota (server reads the user from the token). */
export interface RequestQuota {
  success: boolean;
  allowed: boolean;
  unlimited?: boolean;
  limit?: number;
  used?: number;
  period?: 'daily' | 'weekly' | 'monthly';
}

export type ContactType = 'call' | 'whatsapp';

export interface ProviderLinkedResponse {
  success: boolean;
  /** layer (service discriminator) → feature ids that belong to a registered provider account. */
  linked: Record<string, (number | string)[]>;
}

export const mapEventsApi = {
  ratings: (serviceLayer: string, featureId: string) =>
    api.get<ServiceRatingsResponse>('/api/service-ratings', {
      service_layer: serviceLayer,
      feature_id: featureId,
    }),
  providerLinked: () => api.get<ProviderLinkedResponse>('/api/provider-linked-features'),
  checkRequestLimit: () => api.post<RequestQuota>('/api/check-request-limit', {}),
  logContactClick: (body: {
    service_layer: string;
    feature_id: string;
    provider_name: string;
    contact_type: ContactType;
  }) => api.post<{ success: boolean; id: number }>('/api/log-contact-click', body),
  /** Legacy "stats" row (dashboard counters). Public endpoint; user_id is the account id or a guest id. */
  saveStat: (body: { user_id: string; provider: string; service: string }) =>
    api.post<unknown>('/save-stat', body),
  logMapEvent: (body: { event_type: 'map_click'; provider: string; service: string }) =>
    api.post<unknown>('/api/log-map-event', body),
};

export const mapEventKeys = {
  ratings: (layer: string, id: string) => ['service-ratings', layer, id] as const,
  providerLinked: ['provider-linked-features'] as const,
};

export function useServiceRatings(layer: string | null, featureId: string | null) {
  return useQuery({
    queryKey: mapEventKeys.ratings(layer ?? '', featureId ?? ''),
    queryFn: () => mapEventsApi.ratings(layer!, featureId!),
    enabled: !!layer && !!featureId,
    staleTime: 60_000,
  });
}

/** Which service features belong to a registered provider (they get "Request service" instead of WhatsApp). */
export function useProviderLinked() {
  return useQuery({
    queryKey: mapEventKeys.providerLinked,
    queryFn: mapEventsApi.providerLinked,
    staleTime: 5 * 60_000,
    select: (d) => {
      const sets = new Map<string, Set<string>>();
      for (const [layer, ids] of Object.entries(d.linked ?? {})) sets.set(layer, new Set(ids.map(String)));
      return sets;
    },
  });
}
