import { useEffect, useState } from 'react';
import { CheckCircle2, ImagePlus, LocateFixed, MapPin, Radio, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import FormField from '@/components/ui/FormField';
import SelectInput from '@/components/ui/SelectInput';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/toastStore';
import { useAuthStore } from '@/store/authStore';
import { useOlMap } from '../MapContext';
import MapSheet from '../panels/MapSheet';
import { flyToProvider } from './flyLayer';
import { AVAILABLE, providerTarget, supportsLocationUpdates } from './model';
import { targetLabelKey } from '../targets';
import { useIsProvider, useProviderAccount, useProviderFeature } from './queries';
import { useProviderUi } from './store';
import { useProviderActions } from './useProviderActions';

/** Seconds left of the post-update lock; re-renders once a second while it runs. */
function useCooldown() {
  const until = useProviderUi((s) => s.cooldownUntil);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const id = setInterval(() => {
      update();
      if (Date.now() >= until) clearInterval(id);
    }, 250);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/**
 * Status + location of the provider's own listing (legacy "لوحة إدارة الخدمة الحية"); the details and pictures are edited
 * in "my listings", one tap away.
 */
export default function ProviderPanel() {
  const isProvider = useIsProvider();
  const open = useProviderUi((s) => s.open);
  if (!isProvider || !open) return null;
  return <Panel onClose={() => useProviderUi.getState().closePanel()} />;
}

function Panel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const map = useOlMap();
  const name = useAuthStore((s) => s.user?.full_name);
  const live = useProviderUi((s) => s.live);
  const error = useProviderUi((s) => s.error);
  const selectedListing = useProviderUi((s) => s.selectedListing);
  const seconds = useCooldown();
  const { isError, refetch } = useProviderAccount();
  const { account, services, service, pending, availableHere, availablePrevious, busy } = useProviderActions();
  useEffect(() => {
    if (services.length > 0 && !services.some((item) => `${item.layer}:${item.featureId}` === selectedListing)) {
      useProviderUi.getState().setSelectedListing(`${services[0].layer}:${services[0].featureId}`);
    }
  }, [selectedListing, services]);
  const featureQuery = useProviderFeature(service ? providerTarget(service.layer) : null, service?.featureId);
  const featureName = service?.name || String(featureQuery.data?.name ?? '');
  const supportsLocation = service ? supportsLocationUpdates(service.layer) : false;
  const selectedKey = service ? `${service.layer}:${service.featureId}` : '';

  const locked = seconds > 0 || pending;
  const available = service?.status === AVAILABLE;

  const flyToMe = () => {
    if (!service?.location) return toast.info(t('provider.noLocation'));
    if (map) flyToProvider(map, service.location);
    if (window.innerWidth < 640) onClose();
  };

  return (
    <MapSheet side="start" label={t('provider.title')} title={t('provider.title')} onClose={onClose}>
      <div className="space-y-3">
        {name && (
          <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm font-bold text-brand-fg">
            {t('provider.welcome', { name })}
          </p>
        )}

        {account === undefined ? (
          isError ? (
            <div className="space-y-2">
              <AlertMessage type="error" message={t('provider.loadFailed')} />
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner size="sm" /> {t('provider.checking')}
            </p>
          )
        ) : account?.kind !== 'ready' ? (
          <AlertMessage type="error" message={t('provider.noAccess')} />
        ) : (
          <>
            {services.length > 1 && (
              <FormField label={t('provider.selectListing')} name="provider-listing">
                <SelectInput
                  id="provider-listing"
                  value={selectedListing ?? selectedKey}
                  onChange={(event) => useProviderUi.getState().setSelectedListing(event.target.value)}
                  options={services.map((item) => ({
                    value: `${item.layer}:${item.featureId}`,
                    label: `${t(targetLabelKey(providerTarget(item.layer) ?? { kind: 'service', discriminator: item.layer }))} — ${item.name || `#${item.featureId}`} (${item.featureId})`,
                  }))}
                />
              </FormField>
            )}
            <div className="rounded-lg bg-subtle px-3 py-2 text-sm">
              <p className="font-semibold text-fg">
                {service ? t(targetLabelKey(providerTarget(service.layer) ?? { kind: 'service', discriminator: service.layer })) : ''}
              </p>
              {featureName && <p className="mt-1 text-fg">{featureName}</p>}
              {service && <p className="mt-1 font-mono text-muted" dir="ltr">ID {service.featureId}</p>}
            </div>
            <p
              className={`flex items-center gap-2 text-sm font-semibold ${available ? 'text-ok' : 'text-danger'}`}
              role="status"
            >
              {available ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {t(available ? 'provider.statusAvailable' : 'provider.statusBusy')}
            </p>
            {error && <AlertMessage type="error" message={error} />}
            {seconds > 0 && <p className="text-sm text-muted">{t('provider.cooldown', { seconds })}</p>}

            <div className="grid gap-2">
              <Button
                startIcon={<MapPin className="h-4 w-4" />}
                disabled={locked || live}
                loading={pending}
                onClick={() => void (supportsLocation ? availableHere() : availablePrevious())}
              >
                {t(supportsLocation ? 'provider.availableHere' : 'provider.availableAtListing')}
              </Button>
              {supportsLocation && (
                <Button variant="secondary" disabled={locked || live} onClick={() => void availablePrevious()}>
                  {t('provider.availablePrevious')}
                </Button>
              )}
              <Button
                variant="danger"
                disabled={locked}
                onClick={() => {
                  useProviderUi.getState().setLive(false);
                  void busy();
                }}
              >
                {t('provider.busy')}
              </Button>
              {supportsLocation && (
                <Button
                  variant={live ? 'primary' : 'secondary'}
                  startIcon={<Radio className="h-4 w-4" />}
                  aria-pressed={live}
                  onClick={() => useProviderUi.getState().setLive(!live)}
                >
                  {t(live ? 'provider.trackStop' : 'provider.trackStart')}
                </Button>
              )}
              <Button variant="ghost" startIcon={<LocateFixed className="h-4 w-4" />} onClick={flyToMe}>
                {t('provider.flyToMe')}
              </Button>
            </div>
            <div className="border-t border-line pt-3">
              <ButtonLink
                to="/my-listings"
                variant="secondary"
                className="w-full"
                startIcon={<ImagePlus className="h-4 w-4" aria-hidden />}
              >
                {t('provider.editDetails')}
              </ButtonLink>
              <p className="mt-1.5 text-xs text-muted">{t('provider.editDetailsHint')}</p>
            </div>
          </>
        )}
      </div>
    </MapSheet>
  );
}
