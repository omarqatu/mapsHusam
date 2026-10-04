import { mapEventsApi } from '@/api/mapEvents';
import i18n from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { text, type SelectedFeature } from './featureModel';
import { serviceLabelKey } from '../registry';

/**
 * Stats row for the admin dashboard (legacy `map_click`): who opened which provider. Logged-in users only; never blocks
 * and never shows an error. The stored service title is Arabic (dashboard data).
 */
export function logMapClick(sel: SelectedFeature) {
  if (!useAuthStore.getState().user) return;
  const ar = i18n.getFixedT('ar');
  const title =
    sel.kind.kind === 'service'
      ? ar(serviceLabelKey(sel.kind.discriminator))
      : sel.kind.kind === 'realEstate'
        ? ar(`layers.${sel.kind.layer}`)
        : '';
  void mapEventsApi
    .logMapEvent({
      event_type: 'map_click',
      provider: text(sel.props.name) || text(sel.props.location_name) || 'غير معروف',
      service: title,
    })
    .catch(() => undefined);
}
