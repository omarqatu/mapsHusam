import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowRight, ChevronDown, ChevronUp, Eye, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ViewRequest } from '@/api/adminUsers';
import AlertMessage from '@/components/ui/AlertMessage';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataField from '@/components/ui/DataField';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/lib/format';
import { errorText } from '@/lib/errorText';
import { useViewMessages, useViewSession } from './hooks/useAdminUsers';

const statusTone: Record<string, BadgeTone> = {
  pending: 'amber',
  accepted: 'blue',
  completed: 'green',
  rejected: 'red',
  cancelled: 'slate',
};

function Messages({
  userId,
  token,
  requestId,
}: {
  userId: number;
  token: string | undefined;
  requestId: number;
}) {
  const { t, i18n } = useTranslation();
  const q = useViewMessages(userId, token, requestId, true);
  if (q.isLoading) return <CenteredSpinner minHeight="4rem" />;
  if (q.isError)
    return <AlertMessage type="error" message={errorText(q.error, t('adminView.messagesFailed'))} />;
  const messages = q.data?.messages ?? [];
  if (!messages.length) return <p className="text-sm text-slate-600">{t('adminView.noMessages')}</p>;
  return (
    <ul className="space-y-2" aria-label={t('adminView.messages')}>
      {messages.map((m) => (
        <li key={m.id} className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="mb-1 text-xs font-bold text-slate-600">
            {t(`adminView.sender.${m.sender_role}`, m.sender_role)}
          </div>
          <p className="whitespace-pre-wrap break-words text-slate-800">{m.message}</p>
          <div className="mt-1 text-xs text-slate-500">{formatDateTime(m.created_at, i18n.language)}</div>
        </li>
      ))}
    </ul>
  );
}

function RequestItem({
  userId,
  token,
  request,
}: {
  userId: number;
  token: string | undefined;
  request: ViewRequest;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const status = request.status ?? '';
  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-slate-900">
          {request.service_type || t('adminView.defaultService')} #{request.id}
        </strong>
        <Badge tone={statusTone[status] ?? 'slate'}>{t(`adminView.status.${status}`, status || '—')}</Badge>
      </div>
      <div className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <DataField label={t('adminView.requester')} value={request.requester_name} />
        <DataField label={t('adminView.provider')} value={request.provider_full_name} />
        <DataField label={t('adminView.date')} value={formatDateTime(request.created_at, i18n.language)} />
      </div>
      {request.cancellation_reason && (
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-semibold">{t('adminView.cancelReason')}: </span>
          {request.cancellation_reason}
        </p>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        aria-expanded={open}
        startIcon={<MessageSquare className="h-4 w-4" />}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? t('adminView.hideMessages') : t('adminView.showMessages')}
        {open ? (
          <ChevronUp className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden />
        )}
      </Button>
      {open && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <Messages userId={userId} token={token} requestId={request.id} />
        </div>
      )}
    </li>
  );
}

/** `/admin/users/:id/view` — read-only look at one account and its requests / chats (legacy admin-view-user.html). */
export default function AdminViewUserPage() {
  const { t, i18n } = useTranslation();
  const userId = Number(useParams().id);
  const { session, profile, requests } = useViewSession(userId);
  const token = session.data?.token;
  const expiresAt = session.data ? new Date(session.dataUpdatedAt + session.data.expires_in * 1000) : null;
  const user = profile.data?.user ?? session.data?.user;

  const back = (
    <Link
      to="/admin/users"
      className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-50"
    >
      <ArrowRight className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />
      {t('adminView.back')}
    </Link>
  );

  return (
    <>
      <PageHeader
        title={t('adminView.title')}
        description={
          expiresAt
            ? t('adminView.expires', {
                time: expiresAt.toLocaleTimeString(i18n.language === 'ar' ? 'ar-EG' : 'en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })
            : t('adminView.temporary')
        }
        icon={<Eye className="h-6 w-6" aria-hidden />}
        actions={
          <>
            <Badge tone="amber">{t('adminView.readOnly')}</Badge>
            {back}
          </>
        }
      />

      {!Number.isInteger(userId) || userId <= 0 ? (
        <AlertMessage type="error" message={t('adminView.invalid')} />
      ) : session.isLoading ? (
        <CenteredSpinner />
      ) : session.isError ? (
        <AlertMessage type="error" message={errorText(session.error, t('adminView.sessionFailed'))} />
      ) : (
        <div className="space-y-4">
          <SectionCard title={t('adminView.profile')}>
            {profile.isError ? (
              <AlertMessage type="error" message={errorText(profile.error, t('adminView.profileFailed'))} />
            ) : !user ? (
              <CenteredSpinner minHeight="4rem" />
            ) : (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <DataField label={t('adminView.name')} value={user.full_name} />
                <DataField label={t('adminView.id')} value={user.user_id} mono />
                <DataField label={t('adminView.phone')} value={user.phone} mono />
                <DataField label={t('adminView.email')} value={user.email} mono />
                <DataField label={t('adminView.role')} value={t(`roles.${user.role}`, user.role)} />
                <DataField
                  label={t('adminView.account')}
                  value={user.is_active ? t('adminUsers.active') : t('adminUsers.inactive')}
                />
                <DataField
                  label={t('adminView.serviceLayer')}
                  value={user.service_layer ? t(`services.${user.service_layer}`, user.service_layer) : null}
                />
                <DataField label={t('adminView.featureId')} value={user.feature_id} mono />
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('adminView.requestsTitle')}>
            {requests.isLoading ? (
              <CenteredSpinner minHeight="4rem" />
            ) : requests.isError ? (
              <AlertMessage type="error" message={errorText(requests.error, t('adminView.requestsFailed'))} />
            ) : (requests.data?.requests.length ?? 0) === 0 ? (
              <EmptyState title={t('adminView.noRequests')} />
            ) : (
              <ul className="space-y-3">
                {requests.data!.requests.map((r) => (
                  <RequestItem key={r.id} userId={userId} token={token} request={r} />
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}
    </>
  );
}
