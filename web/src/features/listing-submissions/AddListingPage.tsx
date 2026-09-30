import type { FormEvent } from 'react';
import { CheckCircle2, Clock, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useCancelSubmission,
  useMySubmissions,
  useSubmitListing,
  type MySubmission,
} from '@/api/listingSubmissions';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/toastStore';
import { serviceLabelKey } from '@/features/map/registry';
import { errorText } from '@/lib/errorText';
import { formatDate } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { AboutFields, ContactFields, LocationField } from './ListingFields';
import { toInput } from './model';
import { useListingForm } from './useListingForm';

/**
 * `/add-listing` — a signed-in user asks for their business to be put on the map. An admin reviews it; on approval the
 * account becomes a provider linked to the new point. One request waits at a time.
 */
export default function AddListingPage() {
  const { t, i18n } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const canSubmit = role === 'user';
  const mine = useMySubmissions(canSubmit);

  const header = (
    <PageHeader
      title={t('submit.title')}
      description={t('submit.subtitle')}
      icon={<Plus className="h-6 w-6" aria-hidden />}
    />
  );

  if (!canSubmit)
    return (
      <>
        {header}
        <AlertMessage
          type="info"
          message={t(role === 'admin' ? 'submit.adminNote' : 'submit.providerNote')}
        />
      </>
    );
  if (mine.isPending) return <CenteredSpinner />;
  if (mine.isError)
    return <AlertMessage type="error" message={errorText(mine.error, t('submit.loadFailed'))} />;

  const latest = mine.data[0] as MySubmission | undefined;
  const pending = latest?.status === 'pending' ? latest : undefined;

  return (
    <>
      {header}
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {latest && latest.status !== 'pending' && <LastDecision submission={latest} lang={i18n.language} />}
        {pending ? <PendingCard submission={pending} lang={i18n.language} /> : <SubmitForm />}
      </div>
    </>
  );
}

function LastDecision({ submission, lang }: { submission: MySubmission; lang: string }) {
  const { t } = useTranslation();
  const approved = submission.status === 'approved';
  return (
    <AlertMessage
      type={approved ? 'success' : 'warning'}
      message={
        approved
          ? t('submit.approved', { name: submission.name })
          : t('submit.rejected', {
              name: submission.name,
              reason: submission.reject_reason ?? '',
              date: submission.reviewed_at ? formatDate(submission.reviewed_at, lang) : '',
            })
      }
    />
  );
}

function PendingCard({ submission, lang }: { submission: MySubmission; lang: string }) {
  const { t } = useTranslation();
  const cancel = useCancelSubmission();
  return (
    <SectionCard title={t('submit.pending.title')} icon={<Clock className="h-5 w-5" aria-hidden />}>
      <p className="text-base font-bold text-fg">{submission.name}</p>
      <p className="mt-1 text-sm text-muted">
        {t(serviceLabelKey(submission.layer))} · {formatDate(submission.created_at, lang)}
      </p>
      <p className="mt-3 text-sm text-fg">{t('submit.pending.body')}</p>
      <div className="mt-4">
        <Button
          variant="secondary"
          loading={cancel.isPending}
          onClick={() =>
            cancel.mutate(submission.id, {
              onSuccess: () => toast.success(t('submit.pending.cancelled')),
              onError: (e) => toast.error(errorText(e, t('submit.pending.cancelFailed'))),
            })
          }
        >
          {t('submit.pending.cancel')}
        </Button>
      </div>
    </SectionCard>
  );
}

function SubmitForm() {
  const { t } = useTranslation();
  const submit = useSubmitListing();
  const form = useListingForm();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.check() || !form.point) return;
    submit.mutate(toInput(form.values, form.point), {
      onSuccess: () => toast.success(t('submit.sent')),
      onError: (err) => toast.error(errorText(err, t('submit.sendFailed'))),
    });
  }

  if (form.layers.isPending) return <CenteredSpinner />;
  if (form.layers.isError)
    return <AlertMessage type="error" message={errorText(form.layers.error, t('submit.loadFailed'))} />;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <SectionCard title={t('submit.sections.about')}>
        <AboutFields form={form} />
      </SectionCard>
      <SectionCard title={t('submit.sections.contact')}>
        <ContactFields form={form} />
      </SectionCard>
      <SectionCard title={t('submit.sections.location')}>
        <LocationField form={form} />
      </SectionCard>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t('submit.reviewNote')}</p>
        <Button
          type="submit"
          size="lg"
          loading={submit.isPending}
          startIcon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
        >
          {t('submit.send')}
        </Button>
      </div>
    </form>
  );
}
