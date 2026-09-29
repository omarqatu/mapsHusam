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
  if (!('geolocation' in navigator) || !secure) return Promise.reject(new GeoError(geolocationErrorKey(2, secure)));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(fromLonLat(pos.coords.longitude, pos.coords.latitude)),
      (err) => reject(new GeoError(geolocationErrorKey(err.code, true))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
