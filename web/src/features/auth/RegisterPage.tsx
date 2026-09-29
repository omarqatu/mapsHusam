import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Lock, Phone, UserRound } from 'lucide-react';
import { useRegister } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import SelectInput from '@/components/ui/SelectInput';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import LegalLinks from '@/features/legal/LegalLinks';
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
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto mt-4 w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      {step === 'terms' ? (
        <TermsStep onContinue={() => setStep('form')} />
      ) : (
        <FormStep onBack={() => setStep('terms')} />
      )}
      <p className="mt-4 text-center text-sm text-slate-500">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-brand hover:underline">
          {t('auth.loginHere')}
        </Link>
      </p>
      <div className="mt-1">
        <LegalLinks keys={['guide']} linkClassName="text-slate-500 text-xs" />
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
      <h1 className="text-xl font-black text-slate-800">{t('auth.register.platformName')}</h1>
      <p className="mt-2 text-sm leading-7 text-slate-600">{t('auth.register.about')}</p>
      <hr className="my-4 border-slate-100" />
      <h2 className="mb-2 font-bold text-slate-700">{t('auth.register.termsTitle')}</h2>
      <ul className="list-disc space-y-1 rounded-lg bg-slate-50 p-3 ps-8 text-sm leading-7 text-slate-700">
        {[1, 2, 3, 4].map((n) => (
          <li key={n}>{t(`auth.register.term${n}`)}</li>
        ))}
      </ul>
      <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>{t('auth.register.agree')}</span>
      </label>
      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
        <p>{t('auth.register.fbAsk')}</p>
        <a
          href={FACEBOOK_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block rounded-lg bg-[#1877f2] px-3 py-2 font-semibold text-white"
        >
          {t('auth.register.fbLink')}
        </a>
        <label className="mt-2 flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
            checked={liked}
            onChange={(e) => setLiked(e.target.checked)}
          />
          <span>{t('auth.register.fbDone')}</span>
        </label>
      </div>
      {!ready && <p className="mt-4 text-sm text-slate-500">{t('auth.register.gateHint')}</p>}
      <Button className="mt-3 w-full" disabled={!ready} onClick={onContinue}>
        {t('auth.register.continue')}
      </Button>
      <div className="mt-3">
        <LegalLinks keys={['terms', 'privacy']} linkClassName="text-brand" />
      </div>
    </>
  );
}

function FormStep({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useRegister();
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState<WhatsappPrefix>('970');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isLocalMobile(phone)) next.phone = t('auth.phoneInvalid');
    if (password.length < MIN_PASSWORD_LENGTH) next.password = t('auth.register.passwordShort');
    setErrors(next);
    if (Object.keys(next).length) return;
    register.mutate(
      {
        name: name.trim(),
        phone: phone.trim(),
        whatsapp_number: toWhatsappNumber(prefix, phone),
        password,
        email: '',
      },
      {
        onSuccess: () => {
          toast.success(t('auth.register.success'));
          navigate('/login', { replace: true });
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
      <h1 className="text-xl font-black text-slate-800">{t('auth.register.title')}</h1>
      <p className="mb-4 mt-1 text-sm text-slate-500">{t('auth.register.intro')}</p>
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
            required
          />
        </FormField>
        <FormField label={t('auth.register.prefix')} name="reg-prefix">
          <SelectInput
            id="reg-prefix"
            name="prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value as WhatsappPrefix)}
            options={WHATSAPP_PREFIXES.map((p) => ({ value: p, label: `+${p}` }))}
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
            required
          />
        </FormField>
        <p className="-mt-3 mb-3 text-xs text-slate-400">{t('auth.register.phoneHint')}</p>
        <FormField label={t('auth.password')} name="reg-password" required error={errors.password}>
          <TextInput
            id="reg-password"
            name="password"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hasError={!!errors.password}
            startIcon={<Lock className="h-4 w-4" />}
            required
          />
        </FormField>
        <p className="-mt-3 mb-3 text-xs text-slate-400">{t('auth.register.passwordHint')}</p>
        <Button
          type="submit"
          className="mt-1 w-full"
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
