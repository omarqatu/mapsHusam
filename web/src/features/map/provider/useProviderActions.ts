import { useCallback, useRef } from 'react';
import type VectorLayer from 'ol/layer/Vector';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/client';
import { toast } from '@/components/ui/toastStore';
import { GeoError, locateOnce } from '../geolocate';
import { useOlMap } from '../MapContext';
import { AVAILABLE, BUSY, COOLDOWN_SECONDS, roundGrid, type ProviderService } from './model';
import { useProviderAccount, useSetProviderStatus } from './queries';
import { useProviderUi } from './store';

interface SendOptions {
  /** Read the phone's GPS and send it with the status (legacy "available (my location)"). */
  gps?: boolean;
  /** A live-tracking tick: no cooldown, no success toast. */
  tick?: boolean;
}

/** The three provider actions of the panel. Shared by the buttons and the live-tracking timer. */
export function useProviderActions() {
  const { t } = useTranslation();
  const map = useOlMap();
  const account = useProviderAccount().data;
  const { mutateAsync, isPending } = useSetProviderStatus();
  const inFlight = useRef(false);

  const send = useCallback(
    async (service: ProviderService, status: typeof AVAILABLE | typeof BUSY, { gps, tick }: SendOptions = {}) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      const ui = useProviderUi.getState();
      try {
        let location;
        if (gps) {
          try {
            location = roundGrid(await locateOnce());
          } catch (e) {
            // Legacy: warn and still set the status, keeping the previous location.
            if (!tick) toast.warning(t(e instanceof GeoError ? e.messageKey : 'provider.gpsFallback'));
          }
        }
        await mutateAsync({ service, status, location });
        ui.setError(null);
        if (!tick) {
          ui.startCooldown(Date.now() + COOLDOWN_SECONDS * 1000);
          toast.success(t(status === AVAILABLE ? 'provider.updatedAvailable' : 'provider.updatedBusy'));
        }
        // The layer shows only available features: reload it so the marker appears / disappears / moves.
        (map?.get('dataLayers') as VectorLayer[] | undefined)?.forEach((l) => l.getSource()?.refresh());
        return true;
      } catch (e) {
        // A failed update unlocks at once (no cooldown) and says why.
        const message = e instanceof ApiError && e.message ? e.message : t('provider.updateFailed');
        ui.setError(message);
        if (!tick) toast.error(message);
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [map, mutateAsync, t],
  );

  const service = account?.kind === 'ready' ? account.service : null;
  return {
    account,
    service,
    pending: isPending,
    availableHere: () => service && send(service, AVAILABLE, { gps: true }),
    availablePrevious: () => service && send(service, AVAILABLE),
    busy: () => service && send(service, BUSY),
    /** Used by the live timer. */
    tick: (s: ProviderService) => send(s, AVAILABLE, { gps: true, tick: true }),
  };
}
