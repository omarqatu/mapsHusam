import { ApiError } from '@/api/client';
import { mapEventsApi, type MapEventType } from '@/api/mapEvents';
import { toast } from '@/components/ui/toastStore';
import { useAuthStore } from '@/store/authStore';

/** `map` = the map page; `quick_search` = the search-without-map page (the server files them under different statistics). */
export type SearchSource = 'map' | 'quick_search';

/**
 * Counts the search against the per-user request quota (POST /api/log-map-event → 429 when exceeded).
 * Fail-open like legacy: a network / server problem never blocks searching. Returns false only on a real "over the limit".
 * Visitors without an account have no quota (the server ignores guests), so nothing is sent for them.
 */
export async function passesSearchQuota(
  event: MapEventType,
  service: string,
  t: (k: string, o?: Record<string, unknown>) => string,
  source: SearchSource = 'map',
): Promise<boolean> {
  if (!useAuthStore.getState().user) return true;
  try {
    await mapEventsApi.logMapEvent({ event_type: event, provider: null, service, source });
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) {
      const quota = (e.data as { quota?: { limit?: number; period?: string } } | undefined)?.quota ?? {};
      toast.warning(
        t('popup.quotaExceeded', {
          limit: quota.limit ?? '',
          period: t(`popup.period.${quota.period ?? 'daily'}`),
        }),
      );
      return false;
    }
    return true;
  }
}
