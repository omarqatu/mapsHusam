// Who worked on a property: "this land was surveyed by X", "valued by Y". A relation between a property and a provider's
// listing that BOTH sides agree to (nobody gets named on a land without their knowledge, and nobody puts a name on a
// land that is not theirs). Pure functions (no database, no express) so they can be unit-tested with `node --test`.
//
// Life of a relation:  pending ──(the other side accepts)──► accepted ──(anyone involved, or an admin)──► revoked
//                      pending ──(declined / withdrawn)──────────────────────────────────────────────► revoked
// Pending = one side asked (that is its consent), the other has not answered. Accepted = both consented.
//
// The two sides:
//   property side — the property's registered owner; for a property nobody owns (a plot an admin drew) an admin;
//   provider side — the owner of the provider's listing. Nobody else can consent for a provider, an admin included.
// A relation gives NO right to rate: a rating stays tied to a completed request. It is a statement by the two sides, shown
// as such on the card — not a guarantee by the platform, and not a verification.

/** relation → the provider type it names and the property tables it may be placed on (V1: land only). */
export const RELATIONS = {
    surveyed_by: { providerLayer: 'land_surveyors', properties: ['LandSale'] },
    valued_by: { providerLayer: 'real_estate_valuers', properties: ['LandSale'] },
};
// Not offered on purpose: a lawyer ("represented the owner of this land") is not something to show publicly on a card.

export const STATUSES = ['pending', 'accepted', 'revoked'];

/** `null` when this relation may join this property to this provider's listing, else a reason. */
export function relationError(relation, propertyLayer, providerLayer) {
    const def = RELATIONS[relation];
    if (!def) return 'نوع العلاقة غير صالح.';
    if (!def.properties.includes(propertyLayer)) return 'هذه العلاقة غير متاحة لهذا النوع من العقارات.';
    if (def.providerLayer !== providerLayer) return 'هذا المزود ليس من النوع المطلوب لهذه العلاقة.';
    return null;
}

/**
 * Which side(s) this account may act for on this property/provider pair.
 * `{ ownsProperty, propertyHasOwner, ownsProvider, isAdmin }` → `{ property, provider }`.
 * An admin stands in for the property side only when the property has no registered owner.
 */
export function sidesOf({ ownsProperty, propertyHasOwner, ownsProvider, isAdmin }) {
    return {
        property: !!ownsProperty || (!!isAdmin && !propertyHasOwner),
        provider: !!ownsProvider,
    };
}

/** What creating a relation does for a caller with these sides: `null` (may not), or the consents the new row starts with. */
export function startingConsent(sides) {
    if (!sides.property && !sides.provider) return null;
    return { property: sides.property, provider: sides.provider };
}

export const statusOf = (consent) => (consent.property && consent.provider ? 'accepted' : 'pending');

/** The side whose answer a pending relation waits for (`null` when it is not pending). */
export function waitingFor(row) {
    if (row.status !== 'pending') return null;
    return row.property_ok_by ? 'provider' : 'property';
}

/** May a caller with these sides accept or decline this row? */
export const canAnswer = (row, sides) => {
    const side = waitingFor(row);
    return side !== null && !!sides[side];
};

/** May they take it back? Anyone involved while it lives (pending or accepted); an admin always. */
export const canRevoke = (row, sides, isAdmin) =>
    row.status !== 'revoked' && (!!isAdmin || sides.property || sides.provider);
