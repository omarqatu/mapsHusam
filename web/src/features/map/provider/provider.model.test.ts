import { describe, expect, it } from 'vitest';
import type { ProviderServiceResponse } from '@/api/provider';
import { interpretService, providerTarget, roundGrid, toStatus, validLocation } from './model';

const linked = (over: Partial<Extract<ProviderServiceResponse, { success: true }>> = {}, status: unknown = 0) =>
  ({
    success: true,
    show_panel: true,
    user_status: 0,
    service: {
      service_layer: 'plumber',
      feature_id: 7,
      id: 7,
      status,
      x_coord: '169463.41',
      y_coord: '145767.99',
    },
    ...over,
  }) as ProviderServiceResponse;

describe('interpretService', () => {
  it('not linked -> unlinked', () => {
    expect(interpretService({ success: false, message: 'x' })).toEqual({ kind: 'unlinked' });
  });
  it('a frozen account (users.status != 0) -> frozen, even with a service', () => {
    expect(interpretService(linked({ user_status: 1 }))).toEqual({ kind: 'frozen' });
    expect(interpretService(linked({ user_status: null }))).toEqual({ kind: 'frozen' });
  });
  it('reads numeric strings from Postgres', () => {
    expect(interpretService(linked())).toEqual({
      kind: 'ready',
      service: { layer: 'plumber', featureId: 7, status: 0, location: [169463.41, 145767.99] },
    });
  });
  it('anything but 0 is busy; a missing position is null', () => {
    const r = interpretService(linked({}, '1'));
    expect(r.kind === 'ready' && r.service.status).toBe(1);
    expect(toStatus(null)).toBe(1);
    expect(toStatus('0')).toBe(0);
  });
});

describe('validLocation / roundGrid', () => {
  it('needs both numbers and easting above 100 000', () => {
    expect(validLocation(null, null)).toBeNull();
    expect(validLocation('', '5')).toBeNull();
    expect(validLocation(50_000, 140_000)).toBeNull();
    expect(validLocation('170000', '140000')).toEqual([170000, 140000]);
  });
  it('rounds to two decimals', () => {
    expect(roundGrid([169463.41234, 145767.99876])).toEqual([169463.41, 145768]);
  });
});

describe('providerTarget', () => {
  it('maps service types and real-estate layers, refuses unknown ones', () => {
    expect(providerTarget('plumber')).toEqual({ kind: 'service', discriminator: 'plumber' });
    expect(providerTarget('ApartRent')).toEqual({ kind: 'realEstate', layer: 'rent' });
    expect(providerTarget('nope')).toBeNull();
    expect(providerTarget('rent')).toBeNull();
  });
});
