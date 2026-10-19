import { useEffect, useRef } from 'react';
import { useOlMap } from '../MapContext';
import { clearProviderMarker } from './flyLayer';
import { LIVE_INTERVAL_MS, supportsLocationUpdates } from './model';
import { useProviderActions } from './useProviderActions';
import { useProviderUi } from './store';
import { useVisibility } from '@/features/visibility/store';

/**
 * Invisible; mounted on the map page for provider accounts. Owns the live-tracking timer (so it keeps running while the
 * panel is closed) and cleans up the provider's marker. Tracking stops when the account can no longer update.
 */
export default function ProviderTracker() {
  const map = useOlMap();
  const live = useProviderUi((s) => s.live);
  const visibility = useVisibility();
  const { service, tick } = useProviderActions();
  const latest = useRef({ service, tick });
  useEffect(() => {
    latest.current = { service, tick };
  });
  const ready = service !== null;
  const canTrack = service !== null && supportsLocationUpdates(service.layer, visibility.providerMovableLayers);

  // Legacy showed the panel at once; on a phone it would cover the map, so only wide screens open it by themselves.
  const opened = useRef(false);
  useEffect(() => {
    if (ready && !opened.current && window.innerWidth >= 640) useProviderUi.getState().openPanel();
    if (ready) opened.current = true;
  }, [ready]);

  useEffect(() => {
    if (!live) return;
    if (!canTrack) {
      useProviderUi.getState().setLive(false);
      return;
    }
    const run = () => {
      const { service: s, tick: send } = latest.current;
      if (s) void send(s);
    };
    run();
    const id = setInterval(run, LIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [canTrack, live]);

  useEffect(
    () => () => {
      useProviderUi.getState().setLive(false);
      if (map) clearProviderMarker(map);
    },
    [map],
  );
  return null;
}
