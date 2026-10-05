import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

// Who worked on a property ("surveyed by", "valued by"): a relation between a property and a provider's listing that BOTH
// sides agree to (server: routes/property-relations.js, rules in lib/property-relations.js). Only accepted ones are public.

export type RelationKind = 'surveyed_by' | 'valued_by';
export type RelationStatus = 'pending' | 'accepted' | 'revoked';
export type RelationSide = 'property' | 'provider';

/** An accepted relation, as a property's card shows it. */
export interface PublicRelation {
  id: number;
  relation: RelationKind;
  provider_layer: string;
  provider_id: number;
  provider_name: string;
  accepted_at: string;
}

/** A relation the account is a side of, with what it may do with it. */
export interface MyRelation {
  id: number;
  relation: RelationKind;
  status: RelationStatus;
  property_layer: string;
  property_id: number;
  property_name: string;
  /** false = a plot nobody owns: an admin answers for the property side. */
  property_has_owner: boolean;
  provider_layer: string;
  provider_id: number;
  provider_name: string;
  /** Whose answer a pending relation waits for. */
  waiting_for: RelationSide | null;
  i_asked: boolean;
  can_answer: boolean;
  can_revoke: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewRelation {
  property_layer: string;
  property_id: number | string;
  relation: RelationKind;
  provider_layer: string;
  provider_id: number | string;
}

export const propertyRelationsKeys = {
  all: ['property-relations'] as const,
  property: (layer: string, id: string) => ['property-relations', 'property', layer, id] as const,
  mine: ['property-relations', 'mine'] as const,
};

export const propertyRelationsApi = {
  forProperty: (layer: string, id: string) =>
    api.get<{ success: boolean; items: PublicRelation[] }>('/api/property-relations', {
      property_layer: layer,
      property_id: id,
    }),
  mine: () => api.get<{ success: boolean; items: MyRelation[] }>('/api/my-property-relations'),
  create: (body: NewRelation) =>
    api.post<{ success: boolean; id: number; status: RelationStatus; waiting_for: RelationSide | null }>(
      '/api/property-relations',
      body,
    ),
  respond: (id: number, accept: boolean) =>
    api.post<{ success: boolean; status: RelationStatus }>(`/api/property-relations/${id}/respond`, { accept }),
  revoke: (id: number) => api.post<{ success: boolean }>(`/api/property-relations/${id}/revoke`),
};

/** The accepted relations of one property (public). */
export const usePropertyRelations = (layer: string | null, id: string | null) =>
  useQuery({
    queryKey: propertyRelationsKeys.property(layer ?? '', id ?? ''),
    queryFn: () => propertyRelationsApi.forProperty(layer!, id!).then((r) => r.items),
    enabled: !!layer && !!id,
    staleTime: 60_000,
  });

/** Every relation this account is a side of (signed in only). */
export const useMyPropertyRelations = (enabled = true) =>
  useQuery({
    queryKey: propertyRelationsKeys.mine,
    queryFn: () => propertyRelationsApi.mine().then((r) => r.items),
    enabled,
    staleTime: 30_000,
  });

/** Any change reaches every list: the card's public list and the account's own. */
function useInvalidateRelations() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: propertyRelationsKeys.all });
}

export function useCreateRelation() {
  const done = useInvalidateRelations();
  return useMutation({ mutationFn: propertyRelationsApi.create, onSuccess: done });
}

export function useRespondRelation() {
  const done = useInvalidateRelations();
  return useMutation({
    mutationFn: (v: { id: number; accept: boolean }) => propertyRelationsApi.respond(v.id, v.accept),
    onSuccess: done,
  });
}

export function useRevokeRelation() {
  const done = useInvalidateRelations();
  return useMutation({ mutationFn: (id: number) => propertyRelationsApi.revoke(id), onSuccess: done });
}
