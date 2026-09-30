import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Clock, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useCancelSubmission,
  useMySubmissions,
  useSubmitListing,
  useSubmittableLayers,
  type MySubmission,
} from '@/api/listingSubmissions';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import FormField from '@/components/ui/FormField';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import SelectInput, { type SelectOption } from '@/components/ui/SelectInput';
import { CenteredSpinner } from '@/components/ui/Spinner';
import TextInput from '@/components/ui/TextInput';
import TextareaInput from '@/components/ui/TextareaInput';
import { toast } from '@/components/ui/toastStore';
import type { Coordinate } from '@/features/map/config';
import { SERVICE_BY_KEY, groupLabelKey, serviceLabelKey } from '@/features/map/registry';
import { errorText } from '@/lib/errorText';
import { formatDate } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import LocationPicker from './LocationPicker';
import {
  DES_MAX,
  EMPTY_FORM,
  HOURS_MAX,
  NAME_MAX,
  hasPriceField,
  toInput,
  validate,
  type FormErrors,
  type FormValues,
} from './model';

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
  const layers = useSubmittableLayers();
  const submit = useSubmitListing();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [point, setPoint] = useState<Coordinate | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const options = useMemo<SelectOption[]>(
    () =>
      (layers.data ?? [])
        .map((key) => SERVICE_BY_KEY.get(key))
        .filter((s) => s !== undefined)
        .map((s) => ({
          value: s.key,
          label: `${s.icon} ${t(serviceLabelKey(s.key))}`,
          group: t(groupLabelKey(s.group)),
        })),
    [layers.data, t],
  );

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const message = (key: keyof FormErrors) =>
    errors[key] ? t(`submit.errors.${key}.${errors[key]}`) : undefined;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(values, point);
    setErrors(found);
    if (Object.keys(found).length > 0 || !point) return;
    submit.mutate(toInput(values, point), {
      onSuccess: () => toast.success(t('submit.sent')),
      onError: (err) => toast.error(errorText(err, t('submit.sendFailed'))),
    });
  }

  if (layers.isPending) return <CenteredSpinner />;
  if (layers.isError)
    return <AlertMessage type="error" message={errorText(layers.error, t('submit.loadFailed'))} />;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <SectionCard title={t('submit.sections.about')}>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormField
            label={t('submit.fields.layer')}
            name="layer"
            required
            error={message('layer')}
            className="sm:col-span-2"
          >
            <SelectInput
              id="layer"
              searchable
              options={options}
              value={values.layer}
              placeholder={t('submit.fields.layerPlaceholder')}
              hasError={!!errors.layer}
              onChange={(e) => set('layer', e.target.value)}
            />
          </FormField>
          <FormField
            label={t('submit.fields.name')}
            name="name"
            required
            error={message('name')}
            className="sm:col-span-2"
          >
            <TextInput
              id="name"
              value={values.name}
              maxLength={NAME_MAX}
              hasError={!!errors.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </FormField>
          <FormField label={t('submit.fields.des')} name="des" className="sm:col-span-2">
            <TextareaInput
              id="des"
              rows={3}
              value={values.des}
              maxLength={DES_MAX}
              onChange={(e) => set('des', e.target.value)}
            />
          </FormField>
          <FormField label={t('submit.fields.workHours')} name="workHours">
            <TextInput
              id="workHours"
              value={values.workHours}
              maxLength={HOURS_MAX}
              placeholder={t('submit.fields.workHoursHint')}
              onChange={(e) => set('workHours', e.target.value)}
            />
          </FormField>
          {hasPriceField(values.layer) && (
            <FormField label={t('submit.fields.price')} name="price" error={message('price')}>
              <TextInput
                id="price"
                inputMode="decimal"
                dir="ltr"
                value={values.price}
                hasError={!!errors.price}
                onChange={(e) => set('price', e.target.value)}
              />
            </FormField>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t('submit.sections.contact')}>
        <FormField label={t('submit.fields.phone')} name="phone" required error={message('phone')}>
          <TextInput
            id="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            placeholder="05XXXXXXXX"
            value={values.phone}
            hasError={!!errors.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </FormField>
        <Checkbox
          checked={values.whatsappSame}
          onChange={(checked) => set('whatsappSame', checked)}
          label={t('submit.fields.whatsappSame')}
        />
      </SectionCard>

      <SectionCard title={t('submit.sections.location')}>
        <LocationPicker
          value={point}
          onChange={(p) => {
            setPoint(p);
            setErrors((e) => ({ ...e, point: undefined }));
          }}
          invalid={!!errors.point}
        />
        {errors.point && (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {message('point')}
          </p>
        )}
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
