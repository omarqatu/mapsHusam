import type { Coordinate } from './config';
import { geolocationErrorKey } from './mapUtils';
import { fromLonLat } from './projection';

/** A failed GPS fix; `messageKey` is the i18n key to show (`map.gps.*`). */
export class GeoError extends Error {
  messageKey: string;
  constructor(messageKey: string) {
    super(messageKey);
    this.name = 'GeoError';
    this.messageKey = messageKey;
  }
}

/** One GPS fix in Palestine Grid metres (legacy requestGeolocationPosition). Rejects with a `GeoError`. */
export function locateOnce(): Promise<Coordinate> {
  const secure = window.isSecureContext;
  if (!('geolocation' in navigator) || !secure)
    return Promise.reject(new GeoError(geolocationErrorKey(2, secure)));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(fromLonLat(pos.coords.longitude, pos.coords.latitude)),
      (err) => reject(new GeoError(geolocationErrorKey(err.code, true))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

/** Upper bound for the whole wait, the permission prompt included (the browser's own timeout starts only after it). */
const WATCH_DEADLINE_MS = 60_000;

/**
 * First GPS fix from a watch, matching the acquisition method used by the map's locate button. `signal` stops the
 * watch (the screen asking for it went away); the promise then never settles, so the caller has nothing to undo.
 */
export function locateOnceFromWatch(signal?: AbortSignal): Promise<Coordinate> {
  const secure = window.isSecureContext;
  if (!('geolocation' in navigator) || !secure)
    return Promise.reject(new GeoError(geolocationErrorKey(2, secure)));
  return new Promise((resolve, reject) => {
    let watchId: number | null = null;
    const stop = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      clearTimeout(deadline);
      signal?.removeEventListener('abort', stop);
    };
    const finish = (callback: () => void) => {
      stop();
      callback();
    };
    const deadline = setTimeout(() => finish(() => reject(new GeoError(geolocationErrorKey(3, true)))), WATCH_DEADLINE_MS);
    signal?.addEventListener('abort', stop);
    watchId = navigator.geolocation.watchPosition(
      (pos) => finish(() => resolve(fromLonLat(pos.coords.longitude, pos.coords.latitude))),
      (err) => finish(() => reject(new GeoError(geolocationErrorKey(err.code, true)))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    if (signal?.aborted) stop();
  });
}
