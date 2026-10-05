import type { MyListing } from '@/api/myListings';
import type { MyRelation, RelationKind } from '@/api/propertyRelations';

// Mirrors lib/property-relations.js: which provider type each relation names and which property tables it fits (V1: land
// only). The server decides; this only shows or hides what the server would refuse.
export const RELATIONS: Record<RelationKind, { providerLayer: string; properties: readonly string[] }> = {
  surveyed_by: { providerLayer: 'land_surveyors', properties: ['LandSale'] },
  valued_by: { providerLayer: 'real_estate_valuers', properties: ['LandSale'] },
};
export const RELATION_KINDS = Object.keys(RELATIONS) as RelationKind[];

/** Whether a property of this table can have relations at all. */
export const canHaveRelations = (propertyLayer: string) =>
  RELATION_KINDS.some((k) => RELATIONS[k].properties.includes(propertyLayer));

/** The relations a provider of this service type can have with a property (usually one). */
export const relationsOfProvider = (providerLayer: string, propertyLayer?: string): RelationKind[] =>
  RELATION_KINDS.filter(
    (k) => RELATIONS[k].providerLayer === providerLayer && (!propertyLayer || RELATIONS[k].properties.includes(propertyLayer)),
  );

/** A relation that is still alive (asked, or agreed). */
export const isLive = (r: Pick<MyRelation, 'status'>) => r.status !== 'revoked';

export interface Claim {
  relation: RelationKind;
  listing: MyListing;
}

/**
 * What a signed-in provider may say about this property: for each of their listings of a type that names a relation
 * ("I surveyed this"), unless that relation between this property and this listing is already asked or agreed.
 */
export function claimsFor(
  propertyLayer: string,
  propertyId: string,
  listings: readonly MyListing[],
  mine: readonly MyRelation[],
): Claim[] {
  const out: Claim[] = [];
  for (const listing of listings) {
    if (listing.kind !== 'service') continue;
    for (const relation of relationsOfProvider(listing.layer, propertyLayer)) {
      const taken = mine.some(
        (r) =>
          isLive(r) &&
          r.relation === relation &&
          r.property_layer === propertyLayer &&
          String(r.property_id) === propertyId &&
          r.provider_layer === listing.layer &&
          r.provider_id === listing.id,
      );
      if (!taken) out.push({ relation, listing });
    }
  }
  return out;
}

/** This account's own live relation(s) on a property that still wait for an answer (shown as "your request is waiting"). */
export const myWaitingOn = (propertyLayer: string, propertyId: string, mine: readonly MyRelation[]) =>
  mine.filter(
    (r) =>
      r.status === 'pending' &&
      r.i_asked &&
      r.property_layer === propertyLayer &&
      String(r.property_id) === propertyId,
  );

/** Whether a listing's page has a relations section: a property that can have them, or a provider type that names one. */
export const hasRelations = (l: Pick<MyListing, 'layer' | 'kind'>) =>
  l.kind === 'property' ? canHaveRelations(l.layer) : relationsOfProvider(l.layer).length > 0;

/** Whose answer a relation waits for, in words ("the provider", "the owner", "the admin" when nobody owns the property). */
export const statusKey = (r: MyRelation) =>
  r.status === 'accepted'
    ? 'accepted'
    : r.status === 'revoked'
      ? 'ended'
      : r.waiting_for === 'provider'
      ? 'waitingProvider'
      : r.property_has_owner
        ? 'waitingOwner'
        : 'waitingAdmin';
