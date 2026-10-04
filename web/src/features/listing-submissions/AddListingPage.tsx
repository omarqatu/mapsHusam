import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  Search,
  Shapes,
  Store,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useCancelSubmission,
  useMySubmissions,
  useSubmitListing,
  type MySubmission,
} from '@/api/listingSubmissions';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import FormField from '@/components/ui/FormField';
import PageHeader from '@/components/ui/PageHeader';
import SearchInput from '@/components/ui/SearchInput';
import SectionCard from '@/components/ui/SectionCard';
import { CenteredSpinner } from '@/components/ui/Spinner';
import TextInput from '@/components/ui/TextInput';
import TextareaInput from '@/components/ui/TextareaInput';
import { toast } from '@/components/ui/toastStore';
import { matchesQuery } from '@/features/map/extras/status';
import { listingTarget } from '@/features/my-listings/model';
import { targetLabelKey } from '@/features/map/targets';
import { errorText } from '@/lib/errorText';
import { formatDate } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { ContactFields, HoursField, PriceFields } from './ListingFields';
import LocationPicker from './LocationPicker';
import { DES_MAX, NAME_MAX, hasHoursField, hasPriceField, submissionTypeKey, toInput } from './model';
import { useListingForm, type ListingForm } from './useListingForm';

type Step = 'type' | 'place' | 'details';
const STEPS: Step[] = ['type', 'place', 'details'];

/**
 * `/add-listing` — put a service or a flat on the map, in three steps: what it is, where it is (the map moves under a
 * fixed pin, starting at the GPS position), the details. The admins review it; on approval it shows on the map and in
 * "my listings" (a user's account becomes a provider). One request waits at a time.
 */
export default function AddListingPage() {
  const { t, i18n } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const canSubmit = role === 'user' || role === 'provider';
  const mine = useMySubmissions(canSubmit);

  const header = (
    <PageHeader
      title={t('submit.title')}
      description={t('submit.subtitle')}
      icon={<Plus className="h-6 w-6" aria-hidden />}
      actions={
        role === 'provider' ? (
          <ButtonLink
            to="/my-listings"
            variant="secondary"
            startIcon={<Store className="h-4 w-4" aria-hidden />}
          >
            {t('nav.myListings')}
          </ButtonLink>
        ) : undefined
      }
    />
  );

  if (!canSubmit)
    return (
      <>
        {header}
        <AlertMessage type="info" message={t('submit.adminNote')} />
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
        {pending ? <PendingCard submission={pending} lang={i18n.language} /> : <Wizard />}
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
        {t(submissionTypeKey(submission.layer))} · {formatDate(submission.created_at, lang)}
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

function Stepper({ step }: { step: Step }) {
  const { t } = useTranslation();
  const at = STEPS.indexOf(step);
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label={t('submit.steps.label')}>
      {STEPS.map((s, i) => (
        <li
          key={s}
          aria-current={i === at ? 'step' : undefined}
          className={clsx(
            'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold',
            i === at
              ? 'border-brand bg-brand-light text-brand-fg'
              : i < at
                ? 'border-line text-fg'
                : 'border-line text-muted',
          )}
        >
          <span
            className={clsx(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs',
              i < at ? 'bg-ok-solid text-white' : i === at ? 'bg-brand text-white' : 'bg-subtle text-muted',
            )}
          >
            {i < at ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
          </span>
          <span className="truncate">{t(`submit.steps.${s}`)}</span>
        </li>
      ))}
    </ol>
  );
}

function Wizard() {
  const { t } = useTranslation();
  const submit = useSubmitListing();
  const accountPhone = useAuthStore((s) => s.user?.phone ?? '');
  const form = useListingForm();
  const [step, setStep] = useState<Step>('type');
  const top = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);
  // Each step starts at the stepper (on a phone the map would otherwise open below the fold).
  useEffect(() => {
    if (firstStep.current) firstStep.current = false;
    else top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);
  // The account's number is the usual business number: filled in once, still editable.
  const [phoneFilled, setPhoneFilled] = useState(false);
  if (!phoneFilled && accountPhone && !form.values.phone) {
    setPhoneFilled(true);
    form.set('phone', accountPhone);
  }

  if (form.layers.isPending) return <CenteredSpinner />;
  if (form.layers.isError)
    return <AlertMessage type="error" message={errorText(form.layers.error, t('submit.loadFailed'))} />;

  const back = (to: Step) => (
    <Button
      variant="secondary"
      startIcon={<ArrowRight className="h-4 w-4 ltr:rotate-180" aria-hidden />}
      onClick={() => setStep(to)}
    >
      {t('submit.steps.back')}
    </Button>
  );

  function send() {
    if (!form.check() || !form.point) {
      if (form.errors.point || !form.point) setStep('place');
      return;
    }
    submit.mutate(toInput(form.values, form.point), {
      onSuccess: () => toast.success(t('submit.sent')),
      onError: (err) => toast.error(errorText(err, t('submit.sendFailed'))),
    });
  }

  return (
    <div ref={top} className="flex scroll-mt-20 flex-col gap-5">
      <Stepper step={step} />
      {step === 'type' && <TypeStep form={form} onPicked={() => setStep('place')} />}
      {step === 'place' && (
        <SectionCard title={t('submit.steps.placeTitle')} icon={<MapPin className="h-5 w-5" aria-hidden />}>
          <LocationPicker tall value={form.point} onChange={form.setPoint} invalid={!!form.errors.point} />
          <div className="mt-4 flex justify-between gap-2">
            {back('type')}
            <Button
              disabled={!form.point}
              startIcon={<ArrowLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />}
              onClick={() => setStep('details')}
            >
              {t('submit.steps.next')}
            </Button>
          </div>
        </SectionCard>
      )}
      {step === 'details' && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex flex-col gap-5"
        >
          <SectionCard title={t('submit.sections.about')}>
            <DetailsFields form={form} />
          </SectionCard>
          <SectionCard title={t('submit.sections.contact')}>
            <ContactFields form={form} />
          </SectionCard>
          <p className="text-sm text-muted">{t('submit.reviewNote')}</p>
          <div className="flex justify-between gap-2">
            {back('place')}
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
      )}
    </div>
  );
}

/** Every type as a tile, grouped, with a search (the most common way to find one among ~60). */
function TypeStep({ form, onPicked }: { form: ListingForm; onPicked: () => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { options } = form;
  const groups = useMemo(() => {
    const out = new Map<string, typeof options>();
    for (const o of options) {
      if (!matchesQuery(o.label, query)) continue;
      const g = o.group ?? '';
      out.set(g, [...(out.get(g) ?? []), o]);
    }
    return [...out.entries()];
  }, [options, query]);

  return (
    <SectionCard title={t('submit.steps.typeTitle')} icon={<Shapes className="h-5 w-5" aria-hidden />}>
      <SearchInput
        value={query}
        onChange={setQuery}
        debounceMs={0}
        placeholder={t('submit.steps.typeSearch')}
      />
      {form.errors.layer && (
        <p role="alert" className="text-sm font-medium text-danger">
          {form.message('layer')}
        </p>
      )}
      <div className="max-h-[55dvh] space-y-4 overflow-y-auto pe-1">
        {groups.map(([group, options]) => (
          <section key={group}>
            <h3 className="mb-2 text-xs font-bold text-muted">{group}</h3>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {options.map((o) => {
                const on = form.values.layer === o.value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        form.set('layer', o.value);
                        onPicked();
                      }}
                      className={clsx(
                        'flex min-h-12 w-full items-center gap-2 rounded-xl border px-3 py-2 text-start text-sm font-semibold',
                        on
                          ? 'border-brand bg-brand-light text-brand-fg'
                          : 'border-line text-fg hover:border-brand/50 hover:bg-subtle',
                      )}
                    >
                      {o.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {groups.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Search className="h-4 w-4" aria-hidden />
            {t('common.noData')}
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function DetailsFields({ form }: { form: ListingForm }) {
  const { t } = useTranslation();
  const { values, errors, set, message } = form;
  const target = listingTarget(values.layer);
  return (
    <div className="grid gap-x-4 sm:grid-cols-2">
      {target && (
        <p className="text-sm text-muted sm:col-span-2">
          {t('submit.steps.chosenType', { type: t(targetLabelKey(target)) })}
        </p>
      )}
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
      {hasHoursField(values.layer) && <HoursField form={form} />}
      {hasPriceField(values.layer) && <PriceFields form={form} />}
      <p className="text-xs text-muted sm:col-span-2">{t('submit.steps.photosLater')}</p>
    </div>
  );
}
