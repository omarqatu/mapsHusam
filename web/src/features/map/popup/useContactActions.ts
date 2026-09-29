import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { mapEventsApi, type ContactType } from '@/api/mapEvents';
import { toast } from '@/components/ui/toastStore';
import { useAuthStore } from '@/store/authStore';
import { telLink, whatsappLink, type SelectedFeature } from './featureModel';
import { serviceLabelKey } from '../registry';

const COOLDOWN_S = 10;

/** Same key as legacy popup.js, so a click in either UI counts for both. */
export function cooldownRemaining(type: ContactType, featureId: string, now = Date.now()): number {
  const key = `click_cooldown_${type}_${featureId}`;
  try {
    const last = Number.parseInt(localStorage.getItem(key) ?? '', 10);
    if (Number.isFinite(last) && (now - last) / 1000 < COOLDOWN_S)
      return Math.ceil(COOLDOWN_S - (now - last) / 1000);
    localStorage.setItem(key, String(now));
  } catch {
    /* storage blocked: no cooldown */
  }
  return 0;
}

/** Layer name + Arabic type title as the backend logs expect them (dashboard data is Arabic). */
export function contactContext(f: SelectedFeature) {
  const ar = i18n.getFixedT('ar');
  if (f.kind.kind === 'service')
    return { layer: f.kind.discriminator, typeTitleAr: ar(serviceLabelKey(f.kind.discriminator)) };
  if (f.kind.kind === 'realEstate') return { layer: f.kind.layer, typeTitleAr: ar(`layers.${f.kind.layer}`) };
  return { layer: 'location', typeTitleAr: '' };
}

/**
 * Call / WhatsApp buttons (legacy handlePhoneCall / handleServiceRequest):
 * cooldown → quota check (fail-open) → log contact click + stats row → open tel: / WhatsApp.
 */
export function useContactActions() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  async function passesChecks(type: ContactType, f: SelectedFeature): Promise<boolean> {
    const wait = cooldownRemaining(type, f.id ?? 'unknown');
    if (wait > 0) {
      toast.warning(t('popup.cooldown', { seconds: wait }));
      return false;
    }
    // Visitors have no account, so no quota (same as search); the check and the click log need a session.
    if (!user) return true;
    try {
      const quota = await mapEventsApi.checkRequestLimit();
      if (quota.allowed === false) {
        toast.warning(
          t('popup.quotaExceeded', {
            limit: quota.limit ?? '',
            period: t(`popup.period.${quota.period ?? 'daily'}`),
          }),
        );
        return false;
      }
    } catch {
      /* legacy: fail-open — a quota check failure never blocks contacting a provider */
    }
    return true;
  }

  function log(type: ContactType, f: SelectedFeature, providerName: string) {
    const { layer, typeTitleAr } = contactContext(f);
    const label = type === 'call' ? 'اتصال مباشر' : 'واتساب'; // stored as data (legacy wording)
    if (f.id && user)
      void mapEventsApi
        .logContactClick({
          service_layer: layer,
          feature_id: f.id,
          provider_name: providerName,
          contact_type: type,
        })
        .catch(() => undefined);
    if (user)
      void mapEventsApi
        .saveStat({
          user_id: String(user.user_id),
          provider: providerName,
          service: `(${typeTitleAr}) ${label}`,
        })
        .catch(() => undefined);
  }

  async function call(f: SelectedFeature, providerName: string, phone: string) {
    const href = telLink(phone);
    if (!href || !(await passesChecks('call', f))) return;
    log('call', f, providerName);
    window.location.href = href;
  }

  async function whatsapp(f: SelectedFeature, providerName: string, number: string, typeTitle: string) {
    const href = whatsappLink(
      number,
      t('popup.whatsappGreeting', { name: providerName, service: typeTitle }),
    );
    if (!href) return;
    // Open the tab inside the click handler (popup blockers), navigate it once the checks pass.
    const tab = window.open('', '_blank');
    if (!(await passesChecks('whatsapp', f))) {
      tab?.close();
      return;
    }
    log('whatsapp', f, providerName);
    if (tab) {
      tab.opener = null;
      tab.location.href = href;
    } else window.open(href, '_blank', 'noopener,noreferrer');
  }

  return { call, whatsapp };
}
