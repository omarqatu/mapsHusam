import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Phone, Lock } from 'lucide-react';
import { useLogin } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import { isLocalMobile } from './phone';

export default function LoginPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const login = useLogin();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState('');

  if (user) return <Navigate to={from} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isLocalMobile(phone)) {
      setPhoneError(t('auth.phoneInvalid'));
      return;
    }
    setPhoneError('');
    login.mutate(
      { phone: phone.trim(), password },
      {
        onSuccess: ({ user }) => {
          toast.success(t('auth.welcomeBack', { name: user.full_name ?? user.phone }));
          navigate(from, { replace: true });
        },
      },
    );
  };
  const errorMessage =
    login.error instanceof ApiError
      ? login.error.status === 0
        ? t('errors.network')
        : login.error.message
      : login.error
        ? t('errors.generic')
        : '';

  return (
    <div className="mx-auto mt-4 w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <h1 className="text-2xl font-black text-fg">{t('auth.loginTitle')}</h1>
      <p className="mt-1 text-sm text-muted">{t('auth.loginIntro')}</p>
      <p className="mb-4 text-xs text-muted">{t('auth.phoneHint')}</p>
      <form onSubmit={submit} noValidate>
        <AlertMessage type="error" message={errorMessage} className="mb-4" />
        <FormField label={t('auth.phone')} name="phone" required error={phoneError}>
          <TextInput
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            startIcon={<Phone className="h-4 w-4" />}
            hasError={!!phoneError}
            placeholder="0598512667"
            required
          />
        </FormField>
        <FormField label={t('auth.password')} name="password" required>
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            startIcon={<Lock className="h-4 w-4" />}
            required
          />
        </FormField>
        <Button
          type="submit"
          className="mt-2 w-full"
          loading={login.isPending}
          disabled={!phone.trim() || !password}
        >
          {login.isPending ? t('auth.loggingIn') : t('auth.loginSubmit')}
        </Button>
        <p className="mt-2 text-center text-sm text-muted">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-brand-fg hover:underline">
            {t('auth.createAccount')}
          </Link>
        </p>
      </form>
    </div>
  );
}
