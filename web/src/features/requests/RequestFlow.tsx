import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { requestKeys, requestsApi, useCreateRequest } from '@/api/requests';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toastStore';
import { useAuthStore } from '@/store/authStore';
import { errorText } from './errors';
import { useRequestsUi } from './store';
import { useUnseen } from './unseen';

/**
 * "Request service" (legacy ServiceChat.requestService): an existing pending request is not duplicated, an
 * accepted one reopens its chat, otherwise the user confirms and the request is sent.
 */
export default function RequestFlow() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const target = useRequestsUi((s) => s.requestFor);
  const end = useRequestsUi((s) => s.endRequest);
  const uid = useAuthStore((s) => s.user?.user_id);
  const create = useCreateRequest();
  const [ready, setReady] = useState<number | null>(null);
  // `target` identity = one run of the flow.
  const run = target;

  useEffect(() => {
    if (!run) return;
    let alive = true;
    const stop = () => alive && useRequestsUi.getState().endRequest();
    if (!uid) {
      toast.warning(t('requests.flow.loginFirst'));
      stop();
      return;
    }
    if (!run.serviceLayer || !run.featureId) {
      toast.error(t('requests.flow.missingData'));
      stop();
      return;
    }
    // Fresh list, not the cache: the answer decides whether a request is sent at all.
    qc.fetchQuery({ queryKey: requestKeys.mine(uid), queryFn: () => requestsApi.mine(uid), staleTime: 0 })
      .then((res) => {
        if (!alive) return;
        const existing = res.requests?.find(
          (r) =>
            String(r.feature_id) === run.featureId &&
            r.service_layer === run.serviceLayer &&
            (r.status === 'pending' || r.status === 'accepted'),
        );
        if (existing?.status === 'accepted') {
          useRequestsUi.getState().openChat(existing.id);
          stop();
        } else if (existing) {
          toast.warning(t('requests.flow.alreadyPending'));
          stop();
        } else setReady(Date.now());
      })
      // The server also refuses duplicates, so a failed check just goes on to the confirmation.
      .catch(() => alive && setReady(Date.now()));
    return () => {
      alive = false;
      setReady(null);
    };
  }, [run, uid, qc, t]);

  if (!run || ready === null) return null;

  const send = () =>
    create.mutate(
      {
        service_layer: run.serviceLayer,
        feature_id: Number(run.featureId),
        provider_name: run.providerName,
        // The server quotes this in the provider's (Arabic) notification.
        service_type: i18n.getFixedT('ar')(`services.${run.serviceLayer}`, { defaultValue: run.serviceType }),
      },
      {
        onSuccess: (res) => {
          toast.success(t('requests.flow.sent'));
          useUnseen.getState().add(res.requestId);
          end();
        },
        onError: (e) => {
          toast.error(errorText(e, t('requests.flow.failed')));
          end();
        },
      },
    );

  return (
    <ConfirmDialog
      open
      title={t('requests.flow.title')}
      message={t('requests.flow.message', { provider: run.providerName, service: run.serviceType })}
      confirmLabel={t('requests.flow.send')}
      loading={create.isPending}
      onConfirm={send}
      onCancel={end}
    />
  );
}
