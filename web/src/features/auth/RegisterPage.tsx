import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Lock, ShieldCheck, Phone, UserRound } from 'lucide-react';
import { useRegister } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import SelectInput from '@/components/ui/SelectInput';
import TextInput from '@/components/ui/TextInput';
import Checkbox from '@/components/ui/Checkbox';
import { toast } from '@/components/ui/toastStore';
import InlineLegal from '@/features/legal/InlineLegal';
import LegalLinks from '@/features/legal/LegalLinks';
import { AboutFields, ContactFields, LocationField } from '@/features/listing-submissions/ListingFields';
import { toInput } from '@/features/listing-submissions/model';
import { useListingForm } from '@/features/listing-submissions/useListingForm';
import {
  MIN_PASSWORD_LENGTH,
  WHATSAPP_PREFIXES,
  isLocalMobile,
  toWhatsappNumber,
  type WhatsappPrefix,
} from './phone';

const FACEBOOK_PAGE = 'https://www.facebook.com/MapServesPalestine/';

/** Legacy welcome terms step (both boxes must be ticked) + register form. Accounts are created inactive. */
export default function RegisterPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState<'terms' | 'form'>('terms');
  // Where the visitor was (the login sheet passes it): login, after registering, goes back there.
  const back = useLocation().state as { from?: string } | null;
  if (user) return <Navigate to={back?.from ?? '/home'} replace />;
  return (
    <div className="auth-glass-panel mx-auto w-full max-w-xl rounded-[1.75rem] p-5 sm:p-8">
      {step === 'terms' ? (
        <TermsStep onContinue={() => setStep('form')} />
      ) : (
        <FormStep onBack={() => setStep('terms')} />
      )}
      <p className="mt-5 text-center text-sm text-muted">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" state={back} className="font-semibold text-brand-fg hover:underline">
          {t('auth.loginHere')}
        </Link>
      </p>
      <div className="mt-1">
        <LegalLinks keys={['guide']} linkClassName="text-muted text-xs" />
      </div>
    </div>
  );
}

function TermsStep({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState(false);
  const [liked, setLiked] = useState(false);
  const ready = agreed && liked;
  return (
    <>
      <div className="text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4fc3f7] to-[#00e676] text-[#07131d] shadow-lg shadow-cyan-500/20">
          <ShieldCheck className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-xl font-black text-fg sm:text-2xl">{t('auth.register.platformName')}</h1>
        <p className="mt-2 text-sm leading-7 text-muted">{t('auth.register.about')}</p>
      </div>
      <hr className="my-4 border-line" />
      <h2 className="mb-2 font-bold text-fg">{t('auth.register.termsTitle')}</h2>
      <InlineLegal />
      <Checkbox
        className="mt-4 items-start leading-6"
        checked={agreed}
        onChange={setAgreed}
        label={t('auth.register.agree')}
      />
      <div className="mt-3 rounded-xl border border-info-line bg-info-soft/85 p-3 text-sm text-info">
        <p>{t('auth.register.fbAsk')}</p>
        <a
          href={FACEBOOK_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block rounded-lg bg-info-solid px-3 py-2 font-semibold text-white"
        >
          {t('auth.register.fbLink')}
        </a>
        <Checkbox
          className="mt-3 items-start text-info"
          checked={liked}
          onChange={setLiked}
          label={t('auth.register.fbDone')}
        />
      </div>
      {!ready && <p className="mt-4 text-sm text-muted">{t('auth.register.gateHint')}</p>}
      <Button
        size="lg"
        className="mt-3 w-full bg-gradient-to-br from-[#29b6d1] to-[#00c978] text-[#07131d] shadow-lg shadow-emerald-500/20 hover:brightness-105"
        disabled={!ready}
        onClick={onContinue}
      >
        {t('auth.register.continue')}
      </Button>
      <div className="mt-3">
        <LegalLinks keys={['terms', 'privacy']} linkClassName="text-brand-fg" />
      </div>
    </>
  );
}

function FormStep({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const back = useLocation().state as { from?: string } | null;
  const register = useRegister();
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState<WhatsappPrefix>('970');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({});
  const [hasBusiness, setHasBusiness] = useState(false);
  const business = useListingForm(hasBusiness);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isLocalMobile(phone)) next.phone = t('auth.phoneInvalid');
    if (password.length < MIN_PASSWORD_LENGTH) next.password = t('auth.register.passwordShort');
    setErrors(next);
    // The business number defaults to the account's own; the form is validated as it will be sent.
    const effective = { ...business.values, phone: business.values.phone.trim() || phone.trim() };
    const businessOk = !hasBusiness || business.check(effective);
    if (Object.keys(next).length || !businessOk) return;
    register.mutate(
      {
        name: name.trim(),
        phone: phone.trim(),
        whatsapp_number: toWhatsappNumber(prefix, phone),
        password,
        email: '',
        ...(hasBusiness && business.point ? { listing: toInput(effective, business.point) } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t(hasBusiness ? 'auth.register.successBusiness' : 'auth.register.success'));
          navigate('/login', { replace: true, state: back });
        },
      },
    );
  };

  const errorMessage =
    register.error instanceof ApiError
      ? register.error.status === 0
        ? t('errors.network')
        : register.error.message
      : register.error
        ? t('errors.generic')
        : '';

  return (
    <>
      <div className="mb-5 text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4fc3f7] to-[#00e676] text-[#07131d] shadow-lg shadow-cyan-500/20">
          <UserRound className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-xl font-black text-fg sm:text-2xl">{t('auth.register.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('auth.register.intro')}</p>
      </div>
      <form onSubmit={submit} noValidate>
        <AlertMessage type="error" message={errorMessage} className="mb-4" />
        <FormField label={t('auth.register.name')} name="reg-name" required>
          <TextInput
            id="reg-name"
            name="name"
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('auth.register.namePlaceholder')}
            startIcon={<UserRound className="h-4 w-4" />}
            inputSize="lg"
            className="bg-white/80"
            required
          />
        </FormField>
        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
          <FormField label={t('auth.register.prefix')} name="reg-prefix">
            <SelectInput
              id="reg-prefix"
              name="prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value as WhatsappPrefix)}
              options={WHATSAPP_PREFIXES.map((p) => ({ value: p, label: `+${p}` }))}
              inputSize="lg"
            />
          </FormField>
          <FormField label={t('auth.register.phone')} name="reg-phone" required error={errors.phone}>
            <TextInput
              id="reg-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0598512667"
              hasError={!!errors.phone}
              startIcon={<Phone className="h-4 w-4" />}
              inputSize="lg"
              className="bg-white/80"
              required
            />
          </FormField>
        </div>
        <p className="-mt-3 mb-3 text-xs text-muted">{t('auth.register.phoneHint')}</p>
        <FormField label={t('auth.password')} name="reg-password" required error={errors.password}>
          <TextInput
            id="reg-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            dir="ltr"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hasError={!!errors.password}
            startIcon={<Lock className="h-4 w-4" />}
            endIcon={
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                className="rounded p-1 text-muted hover:text-fg"
                aria-label={t(showPassword ? 'auth.hideSecret' : 'auth.showSecret')}
                title={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            inputSize="lg"
            className="bg-white/80"
            required
          />
        </FormField>
        <p className="-mt-3 mb-3 text-xs text-muted">{t('auth.register.passwordHint')}</p>
        <Checkbox
          className="mb-3 items-start leading-6"
          checked={hasBusiness}
          onChange={setHasBusiness}
          label={t('auth.register.hasBusiness')}
        />
        {hasBusiness && (
          <fieldset className="mb-4 rounded-2xl border border-line bg-surface/70 p-4">
            <legend className="px-2 text-sm font-bold text-fg">{t('auth.register.businessTitle')}</legend>
            <p className="mb-3 text-xs text-muted">{t('auth.register.businessHint')}</p>
            {business.layers.isError ? (
              <AlertMessage type="error" message={t('submit.loadFailed')} />
            ) : (
              <>
                <AboutFields form={business} idPrefix="biz-" />
                <ContactFields form={business} idPrefix="biz-" optional />
                <p className="mb-2 mt-3 text-sm font-semibold text-fg">{t('submit.sections.location')}</p>
                <LocationField form={business} />
              </>
            )}
          </fieldset>
        )}
        <Button
          type="submit"
          size="lg"
          className="mt-1 w-full bg-gradient-to-br from-[#29b6d1] to-[#00c978] text-[#07131d] shadow-lg shadow-emerald-500/20 hover:brightness-105"
          loading={register.isPending}
          disabled={!name.trim() || !phone.trim() || !password}
        >
          {register.isPending ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={onBack}>
          {t('auth.register.backToTerms')}
        </Button>
      </form>
    </>
  );
}
