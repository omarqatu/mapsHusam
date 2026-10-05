import test from 'node:test';
import assert from 'node:assert/strict';
import { RELATIONS, canAnswer, canRevoke, relationError, sidesOf, startingConsent, statusOf, waitingFor } from './property-relations.js';

test('a relation names one provider type and the properties it fits', () => {
    assert.equal(relationError('surveyed_by', 'LandSale', 'land_surveyors'), null);
    assert.equal(relationError('valued_by', 'LandSale', 'real_estate_valuers'), null);
    assert.ok(relationError('surveyed_by', 'LandSale', 'real_estate_valuers')); // wrong provider type
    assert.ok(relationError('surveyed_by', 'ApartRent', 'land_surveyors')); // V1 is land only
    assert.ok(relationError('represented_by', 'LandSale', 'lawyers')); // a lawyer is not offered
    assert.deepEqual(Object.keys(RELATIONS).sort(), ['surveyed_by', 'valued_by']);
});

test('an admin stands in for the property side only when nobody owns the property; never for the provider', () => {
    assert.deepEqual(sidesOf({ isAdmin: true, propertyHasOwner: false }), { property: true, provider: false });
    assert.deepEqual(sidesOf({ isAdmin: true, propertyHasOwner: true }), { property: false, provider: false });
    assert.deepEqual(sidesOf({ ownsProperty: true, propertyHasOwner: true }), { property: true, provider: false });
    assert.deepEqual(sidesOf({ ownsProvider: true, propertyHasOwner: false }), { property: false, provider: true });
    assert.deepEqual(sidesOf({ ownsProperty: true, ownsProvider: true, propertyHasOwner: true }), { property: true, provider: true });
});

test('creating: a stranger may not; one side starts pending; someone on both sides is accepted at once', () => {
    assert.equal(startingConsent({ property: false, provider: false }), null);
    assert.equal(statusOf(startingConsent({ property: true, provider: false })), 'pending');
    assert.equal(statusOf(startingConsent({ property: false, provider: true })), 'pending');
    assert.equal(statusOf(startingConsent({ property: true, provider: true })), 'accepted');
});

test('only the side that has not answered can answer; a pending relation waits for exactly one side', () => {
    const askedByProperty = { status: 'pending', property_ok_by: 5, provider_ok_by: null };
    const askedByProvider = { status: 'pending', property_ok_by: null, provider_ok_by: 9 };
    assert.equal(waitingFor(askedByProperty), 'provider');
    assert.equal(waitingFor(askedByProvider), 'property');
    assert.equal(canAnswer(askedByProperty, { property: true, provider: false }), false); // cannot accept your own request
    assert.equal(canAnswer(askedByProperty, { property: false, provider: true }), true);
    assert.equal(canAnswer(askedByProvider, { property: true, provider: false }), true);
    assert.equal(canAnswer({ status: 'accepted' }, { property: true, provider: true }), false);
    assert.equal(waitingFor({ status: 'revoked' }), null);
});

test('anyone involved may take it back while it lives; an admin always; a stranger never; a revoked one is over', () => {
    const live = { status: 'accepted' };
    assert.equal(canRevoke(live, { property: true, provider: false }, false), true);
    assert.equal(canRevoke(live, { property: false, provider: true }, false), true);
    assert.equal(canRevoke(live, { property: false, provider: false }, false), false);
    assert.equal(canRevoke(live, { property: false, provider: false }, true), true);
    assert.equal(canRevoke({ status: 'pending' }, { property: true, provider: false }, false), true); // withdraw / decline
    assert.equal(canRevoke({ status: 'revoked' }, { property: true, provider: true }, true), false);
});
