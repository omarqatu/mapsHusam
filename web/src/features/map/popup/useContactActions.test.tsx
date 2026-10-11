import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/types/auth';
import { useAuthStore } from '@/store/authStore';
import type { SelectedFeature } from './featureModel';
import { contactContext, useContactActions } from './useContactActions';

const contactApiMocks = vi.hoisted(() => ({
  checkRequestLimit: vi.fn(async () => ({ allowed: true })),
  logContactClick: vi.fn(async () => ({ success: true, id: 1 })),
  saveStat: vi.fn(async () => ({})),
}));

vi.mock('@/api/mapEvents', () => ({ mapEventsApi: contactApiMocks }));

const landFeature: SelectedFeature = {
  kind: { kind: 'realEstate', layer: 'land' },
  id: '42',
  props: {},
  coordinate: [1, 2],
};

describe('contact tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({ user: null });
    vi.spyOn(window, 'open').mockReturnValue(null);
  });

  afterEach(() => vi.restoreAllMocks());

  it('sends guest contact statistics from the no-map search with a per-tab visitor id', async () => {
    const { result } = renderHook(() => useContactActions('quick_search'));

    await act(async () => {
      await result.current.whatsapp(landFeature, 'Test listing', '970591234567', 'Land sale');
    });

    expect(contactApiMocks.saveStat).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: expect.stringMatching(/^guest-/),
        provider: 'Test listing',
        source: 'quick_search',
      }),
    );
    expect(contactApiMocks.logContactClick).not.toHaveBeenCalled();
  });

  it.each([
    ['rent', 'ApartRent'],
    ['sale', 'ApartSale'],
    ['land', 'LandSale'],
  ] as const)('records phone clicks on %s listings before dialing', async (layer, serviceLayer) => {
    useAuthStore.setState({ user: { user_id: 7, token: 'test-token' } as AuthUser });
    const { result } = renderHook(() => useContactActions('quick_search'));

    await act(async () => {
      await result.current.call(
        { ...landFeature, kind: { kind: 'realEstate', layer } },
        'Test listing',
        '0591234567',
      );
    });

    expect(contactApiMocks.logContactClick).toHaveBeenCalledWith({
      service_layer: serviceLayer,
      feature_id: '42',
      provider_name: 'Test listing',
      contact_type: 'call',
    });
    expect(contactApiMocks.saveStat).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: '7', source: 'quick_search' }),
    );
  });

  it('logs a signed-in property click with the GeoServer table name and map source', async () => {
    useAuthStore.setState({ user: { user_id: 7, token: 'test-token' } as AuthUser });
    const { result } = renderHook(() => useContactActions());

    await act(async () => {
      await result.current.whatsapp(landFeature, 'Test listing', '970591234567', 'Land sale');
    });

    expect(contactApiMocks.logContactClick).toHaveBeenCalledWith({
      service_layer: 'LandSale',
      feature_id: '42',
      provider_name: 'Test listing',
      contact_type: 'whatsapp',
    });
    expect(contactApiMocks.saveStat).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: '7', source: 'map' }),
    );
  });

  it('waits for search property contact records before opening WhatsApp', async () => {
    useAuthStore.setState({ user: { user_id: 7, token: 'test-token' } as AuthUser });
    let finishStat!: () => void;
    contactApiMocks.saveStat.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishStat = () => resolve({});
        }),
    );
    const tab = { opener: null, location: { href: '' } } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(tab);
    const { result } = renderHook(() => useContactActions('quick_search'));

    const pending = result.current.whatsapp(landFeature, 'Test listing', '970591234567', 'Land sale');
    await vi.waitFor(() => expect(contactApiMocks.logContactClick).toHaveBeenCalled());
    expect(tab.location.href).toBe('');

    finishStat();
    await pending;
    expect(tab.location.href).toContain('api.whatsapp.com');
  });

  it.each([
    ['rent', 'ApartRent'],
    ['sale', 'ApartSale'],
    ['land', 'LandSale'],
  ] as const)('maps the %s property key to %s for the server', (layer, serviceLayer) => {
    expect(
      contactContext({
        ...landFeature,
        kind: { kind: 'realEstate', layer },
      }).layer,
    ).toBe(serviceLayer);
  });
});
