import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Trans, useTranslation } from 'react-i18next';
import { Eye, EyeOff, Lock, Phone, UserRound } from 'lucide-react';
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

/**
 * Registration on one screen: name, phone, password, one box for the terms (with links to them) and an optional
 * "follow us on Facebook". New accounts are active and signed in at once.
 */
export default function RegisterPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  // Where the visitor was (the login sheet passes it): login, after registering, goes back there.
  const back = useLocation().state as { from?: string } | null;
  // Set by the form just before it starts the new account's session.
  const [doneTo, setDoneTo] = useState<string | null>(null);
  if (user) return <Navigate to={doneTo ?? back?.from ?? '/home'} replace />;
  return (
    <div className="auth-glass-panel mx-auto w-full max-w-xl rounded-[1.75rem] p-5 sm:p-8">
      <RegisterForm onDone={setDoneTo} />
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

/** A legal page link inside the agreement sentence (`Trans` passes the words as children). A new tab keeps the form. */
function LegalLink({ to, children }: { to: 'terms' | 'privacy'; children?: ReactNode }) {
  return (
    <a href={`/legal/${to}`} target="_blank" rel="noopener" className="font-semibold text-brand-fg underline">
      {children}
    </a>
  );
}

function FacebookLink({ children }: { children?: ReactNode }) {
  return (
    <a href={FACEBOOK_PAGE} target="_blank" rel="noopener" className="font-semibold text-brand-fg underline">
      {children}
    </a>
  );
}

function RegisterForm({ onDone }: { onDone: (to: string) => void }) {
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
  const [agreed, setAgreed] = useState(false);
  const [followed, setFollowed] = useState(false);
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
        ...(hasBusiness && business.point
          ? { listing: toInput(effective, business.point, business.geometry) }
          : {}),
      },
      {
        onSuccess: ({ user }) => {
          toast.success(t(hasBusiness ? 'auth.register.successBusiness' : 'auth.register.success'));
          if (!user) return navigate('/login', { replace: true, state: back });
          // with a business: its request waits on "add a listing"
          onDone(hasBusiness ? '/add-listing' : (back?.from ?? '/home'));
          useAuthStore.getState().setSession(user);
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
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2dd4bf] to-[#a3e635] text-[#07131d] shadow-lg shadow-teal-500/20">
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
              placeholder=""
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
        {/* A column: each box on its own line (two short labels would otherwise share one on desktop). */}
        <div className="flex flex-col items-start">
          <Checkbox
            className="mb-2 items-start leading-6"
            checked={agreed}
            onChange={setAgreed}
            required
            label={
              <Trans
                i18nKey="auth.register.agree"
                components={{ terms: <LegalLink to="terms" />, privacy: <LegalLink to="privacy" /> }}
              />
            }
          />
          <Checkbox
            className="mb-4 items-start leading-6"
            checked={followed}
            onChange={(on) => {
              setFollowed(on);
              // Optional: ticking it opens the page; it never blocks registering.
              if (on) window.open(FACEBOOK_PAGE, '_blank', 'noopener');
            }}
            label={<Trans i18nKey="auth.register.followFacebook" components={{ fb: <FacebookLink /> }} />}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="mt-1 w-full bg-gradient-to-br from-[#29b6d1] to-[#00c978] text-[#07131d] shadow-lg shadow-emerald-500/20 hover:brightness-105"
          loading={register.isPending}
          disabled={!name.trim() || !phone.trim() || !password || !agreed}
        >
          {register.isPending ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>
      </form>
    </>
  );
}
