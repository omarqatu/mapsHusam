import { describe, expect, it } from 'vitest';
import { canHaveRelations, claimsFor, hasRelations, isLive, myWaitingOn, relationsOfProvider, statusKey } from './model';
import { listing, relation } from './fixtures';

describe('what can have relations', () => {
  it('V1: a land, and the two provider types that name a relation', () => {
    expect(canHaveRelations('LandSale')).toBe(true);
    expect(canHaveRelations('ApartRent')).toBe(false);
    expect(relationsOfProvider('land_surveyors')).toEqual(['surveyed_by']);
    expect(relationsOfProvider('real_estate_valuers', 'LandSale')).toEqual(['valued_by']);
    expect(relationsOfProvider('real_estate_valuers', 'ApartRent')).toEqual([]);
    expect(relationsOfProvider('lawyers')).toEqual([]); // not offered
  });
  it('a listing has a relations section when it can take part', () => {
    expect(hasRelations({ layer: 'LandSale', kind: 'property' })).toBe(true);
    expect(hasRelations({ layer: 'ApartRent', kind: 'property' })).toBe(false);
    expect(hasRelations({ layer: 'land_surveyors', kind: 'service' })).toBe(true);
    expect(hasRelations({ layer: 'plumber', kind: 'service' })).toBe(false);
  });
});

describe('claimsFor — what a provider may say about a property', () => {
  const mine = [listing({}), listing({ id: 5, layer: 'real_estate_valuers', name: 'مخمّن' }), listing({ layer: 'plumber', id: 9 })];

  it('one claim per listing of a type that names a relation; others have none', () => {
    const claims = claimsFor('LandSale', '1', mine, []);
    expect(claims.map((c) => [c.relation, c.listing.id])).toEqual([['surveyed_by', 2], ['valued_by', 5]]);
  });
  it('a property listing of theirs makes no claim; a flat takes none', () => {
    expect(claimsFor('LandSale', '1', [listing({ kind: 'property', layer: 'LandSale' })], [])).toEqual([]);
    expect(claimsFor('ApartRent', '1', mine, [])).toEqual([]);
  });
  it('not again while it is asked or agreed; a revoked one may be asked again; another property is free', () => {
    const asked = relation({ status: 'pending', i_asked: true });
    expect(claimsFor('LandSale', '1', mine, [asked]).map((c) => c.relation)).toEqual(['valued_by']);
    expect(claimsFor('LandSale', '1', mine, [relation({ status: 'accepted' })]).map((c) => c.relation)).toEqual(['valued_by']);
    expect(claimsFor('LandSale', '1', mine, [relation({ status: 'revoked' })]).map((c) => c.relation)).toEqual(['surveyed_by', 'valued_by']);
    expect(claimsFor('LandSale', '2', mine, [asked]).map((c) => c.relation)).toEqual(['surveyed_by', 'valued_by']);
  });
});

describe('waiting and status', () => {
  it('my own pending requests on this property', () => {
    const mine = [
      relation({ id: 1, status: 'pending', i_asked: true }),
      relation({ id: 2, status: 'pending', i_asked: false }), // somebody else asked me
      relation({ id: 3, status: 'accepted', i_asked: true }),
      relation({ id: 4, status: 'pending', i_asked: true, property_id: 9 }),
    ];
    expect(myWaitingOn('LandSale', '1', mine).map((r) => r.id)).toEqual([1]);
  });
  it('says whose answer it waits for; the admin when nobody owns the property', () => {
    expect(statusKey(relation({ waiting_for: 'provider' }))).toBe('waitingProvider');
    expect(statusKey(relation({ waiting_for: 'property', property_has_owner: true }))).toBe('waitingOwner');
    expect(statusKey(relation({ waiting_for: 'property', property_has_owner: false }))).toBe('waitingAdmin');
    expect(statusKey(relation({ status: 'accepted', waiting_for: null }))).toBe('accepted');
    expect(statusKey(relation({ status: 'revoked', waiting_for: null }))).toBe('ended');
    expect(isLive(relation({ status: 'revoked' }))).toBe(false);
  });
});
