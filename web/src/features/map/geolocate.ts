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

/** First GPS fix from a watch, matching the acquisition method used by the map's locate button. */
export function locateOnceFromWatch(): Promise<Coordinate> {
  const secure = window.isSecureContext;
  if (!('geolocation' in navigator) || !secure)
    return Promise.reject(new GeoError(geolocationErrorKey(2, secure)));
  return new Promise((resolve, reject) => {
    let watchId: number | null = null;
    const finish = (callback: () => void) => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      callback();
    };
    watchId = navigator.geolocation.watchPosition(
      (pos) => finish(() => resolve(fromLonLat(pos.coords.longitude, pos.coords.latitude))),
      (err) => finish(() => reject(new GeoError(geolocationErrorKey(err.code, true)))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
