import { useState } from 'react';
import { Check, ExternalLink, Inbox, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useAdminSubmissions,
  useReviewSubmission,
  type AdminSubmission,
  type SubmissionStatus,
} from '@/api/listingSubmissions';
import AlertMessage from '@/components/ui/AlertMessage';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import FormField from '@/components/ui/FormField';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import { CenteredSpinner } from '@/components/ui/Spinner';
import Tabs, { type TabDef } from '@/components/ui/Tabs';
import TextInput from '@/components/ui/TextInput';
import TextareaInput from '@/components/ui/TextareaInput';
import { toast } from '@/components/ui/toastStore';
import { serviceSearchTags } from '@/features/map/edit/attributes';
import { mapLinkTo } from '@/features/map/mapLink';
import type { Coordinate } from '@/features/map/config';
import { targetIcon } from '@/features/map/targets';
import { listingTarget } from '@/features/my-listings/model';
import LocationPicker from './LocationPicker';
import { hasHoursField, isPropertyLayer, submissionTypeKey } from './model';
import { errorText } from '@/lib/errorText';
import { formatDateTime } from '@/lib/format';

const STATUSES: SubmissionStatus[] = ['pending', 'approved', 'rejected'];

/** `/admin/submissions` — requests to add a business. Approving publishes it and makes its owner a provider. */
export default function AdminSubmissionsPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SubmissionStatus>('pending');
  const list = useAdminSubmissions(status);
  const tabs: TabDef<SubmissionStatus>[] = STATUSES.map((id) => ({
    id,
    label: t(`submit.admin.status.${id}`),
  }));

  return (
    <>
      <PageHeader
        title={t('submit.admin.title')}
        description={t('submit.admin.subtitle')}
        icon={<Inbox className="h-6 w-6" aria-hidden />}
      />
      <Tabs
        tabs={tabs}
        value={status}
        onChange={setStatus}
        label={t('submit.admin.status.label')}
        idPrefix="submissions"
        className="mb-4 max-w-md"
      />
      <div
        role="tabpanel"
        id={`submissions-tabpanel-${status}`}
        aria-labelledby={`submissions-tab-${status}`}
      >
        {list.isPending && <CenteredSpinner />}
        {list.isError && (
          <AlertMessage type="error" message={errorText(list.error, t('submit.loadFailed'))} />
        )}
        {list.data?.length === 0 && <EmptyState title={t('submit.admin.empty')} />}
        <div className="flex flex-col gap-4">
          {list.data?.map((s) => (
            <SubmissionCard key={s.id} submission={s} />
          ))}
        </div>
      </div>
    </>
  );
}

function SubmissionCard({ submission: s }: { submission: AdminSubmission }) {
  const { t, i18n } = useTranslation();
  const review = useReviewSubmission();
  const [name, setName] = useState(s.name);
  const [des, setDes] = useState(s.des ?? '');
  const [hours, setHours] = useState(s.work_hours ?? '');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const target = listingTarget(s.layer);
  const pending = s.status === 'pending';
  const flat = isPropertyLayer(s.layer);
  const picked: Coordinate = [Number(s.x_coord), Number(s.y_coord)];
  const [point, setPoint] = useState<Coordinate>(picked);
  const moved = Math.hypot(point[0] - picked[0], point[1] - picked[1]) > 0.5;

  function approve() {
    review.approve.mutate(
      {
        id: s.id,
        body: {
          name,
          des,
          ...(flat ? {} : { work_hours: hours }),
          search_tags: serviceSearchTags(s.layer, name, des),
          ...(moved ? { x_coord: Number(point[0].toFixed(3)), y_coord: Number(point[1].toFixed(3)) } : {}),
        },
      },
      {
        onSuccess: () => toast.success(t('submit.admin.approved')),
        onError: (e) => toast.error(errorText(e, t('submit.admin.approveFailed'))),
      },
    );
  }

  function reject() {
    review.reject.mutate(
      { id: s.id, reason },
      {
        onSuccess: () => {
          setRejecting(false);
          toast.success(t('submit.admin.rejected'));
        },
        onError: (e) => toast.error(errorText(e, t('submit.admin.rejectFailed'))),
      },
    );
  }

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            {target ? targetIcon(target) : '📍'}
          </span>
          <h2 className="text-lg font-black text-fg">{t(submissionTypeKey(s.layer))}</h2>
        </div>
        <Badge tone={pending ? 'amber' : s.status === 'approved' ? 'green' : 'red'}>
          {t(`submit.admin.status.${s.status}`)}
        </Badge>
      </header>

      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
        <span>{t('submit.admin.by', { name: s.user_name ?? '—' })}</span>
        <span dir="ltr">{s.user_phone}</span>
        <span>{formatDateTime(s.created_at, i18n.language)}</span>
      </p>

      <div className="mt-4 grid gap-x-4 sm:grid-cols-2">
        <FormField label={t('submit.fields.name')} name={`name-${s.id}`}>
          <TextInput
            id={`name-${s.id}`}
            value={name}
            disabled={!pending}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        {hasHoursField(s.layer) && (
          <FormField label={t('submit.fields.workHours')} name={`hours-${s.id}`}>
            <TextInput
              id={`hours-${s.id}`}
              value={hours}
              disabled={!pending}
              onChange={(e) => setHours(e.target.value)}
            />
          </FormField>
        )}
        <FormField label={t('submit.fields.des')} name={`des-${s.id}`} className="sm:col-span-2">
          <TextareaInput
            id={`des-${s.id}`}
            rows={2}
            value={des}
            disabled={!pending}
            onChange={(e) => setDes(e.target.value)}
          />
        </FormField>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">{t('submit.fields.phone')}</dt>
          <dd dir="ltr" className="text-start font-semibold text-fg">
            {s.phone}
          </dd>
        </div>
        {s.price !== null && (
          <div>
            <dt className="text-muted">{t(flat ? 'myListings.editor.price' : 'submit.fields.price')}</dt>
            <dd dir="ltr" className="text-start font-semibold text-fg">
              {s.price} {flat ? t(`edit.options.currency.${s.currency ?? 'USD'}`) : '$'}
            </dd>
          </div>
        )}
        {s.area !== null && (
          <div>
            <dt className="text-muted">{t('myListings.editor.area')}</dt>
            <dd dir="ltr" className="text-start font-semibold text-fg">
              {s.area} m²
            </dd>
          </div>
        )}
        <div>
          <dt className="text-muted">{t('submit.admin.location')}</dt>
          <dd>
            <a
              href={mapLinkTo([Number(s.x_coord), Number(s.y_coord)], 19)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-brand-fg underline"
            >
              {t('submit.admin.openOnMap')}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </dd>
        </div>
      </dl>

      {pending && (
        <div className="mt-4 space-y-1">
          <p className="text-sm font-semibold text-fg">{t('submit.admin.checkPoint')}</p>
          <LocationPicker value={point} onChange={setPoint} />
          {moved && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-warn">{t('submit.admin.pointMoved')}</span>
              <Button size="sm" variant="ghost" onClick={() => setPoint(picked)}>
                {t('submit.admin.pointReset')}
              </Button>
            </div>
          )}
        </div>
      )}

      {pending && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            loading={review.approve.isPending}
            startIcon={<Check className="h-4 w-4" aria-hidden />}
            onClick={approve}
          >
            {t('submit.admin.approve')}
          </Button>
          <Button
            variant="dangerSoft"
            startIcon={<X className="h-4 w-4" aria-hidden />}
            onClick={() => setRejecting(true)}
          >
            {t('submit.admin.reject')}
          </Button>
        </div>
      )}

      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={t('submit.admin.rejectTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              loading={review.reject.isPending}
              onClick={reject}
            >
              {t('submit.admin.reject')}
            </Button>
          </>
        }
      >
        <FormField label={t('submit.admin.reason')} name={`reason-${s.id}`} required>
          <TextareaInput
            id={`reason-${s.id}`}
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
        <p className="text-sm text-muted">{t('submit.admin.reasonHint')}</p>
      </Modal>
    </article>
  );
}
