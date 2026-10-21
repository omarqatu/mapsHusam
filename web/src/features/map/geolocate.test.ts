import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeoError, locateOnceFromWatch } from './geolocate';

describe('locateOnceFromWatch', () => {
  const clearWatch = vi.fn();
  let success: PositionCallback | null = null;
  let failure: PositionErrorCallback | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    success = failure = null;
    clearWatch.mockReset();
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (ok: PositionCallback, err: PositionErrorCallback) => {
          success = ok;
          failure = err;
          return 7;
        },
        clearWatch,
      },
    });
  });
  afterEach(() => vi.useRealTimers());

  it('resolves with the first fix and stops the watch', async () => {
    const p = locateOnceFromWatch();
    success?.({ coords: { longitude: 35.2, latitude: 31.9 } } as GeolocationPosition);
    const [x, y] = await p;
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('a browser error is a GeoError with its message key', async () => {
    const p = locateOnceFromWatch();
    failure?.({ code: 1 } as GeolocationPositionError);
    await expect(p).rejects.toEqual(new GeoError('map.gps.denied'));
  });

  it('gives up after the deadline even while the permission prompt is open', async () => {
    const p = locateOnceFromWatch();
    vi.advanceTimersByTime(60_000);
    await expect(p).rejects.toEqual(new GeoError('map.gps.timeout'));
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('an abort stops the watch and the deadline', () => {
    const ctrl = new AbortController();
    void locateOnceFromWatch(ctrl.signal);
    ctrl.abort();
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(vi.getTimerCount()).toBe(0);
  });
});
