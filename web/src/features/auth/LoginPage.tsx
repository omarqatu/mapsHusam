import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Phone, Lock } from 'lucide-react';
import { useLogin } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import TextInput from '@/components/ui/TextInput';

export default function LoginPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const login = useLogin();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  if (user) return <Navigate to={from} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ phone: phone.trim(), password }, { onSuccess: () => navigate(from, { replace: true }) });
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
    <div className="mx-auto mt-10 w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h1 className="mb-5 text-2xl font-black text-slate-800">{t('auth.login')}</h1>
      <form onSubmit={submit} noValidate>
        <AlertMessage type="error" message={errorMessage} className="mb-4" />
        <FormField label={t('auth.phone')} name="phone" required>
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
          {login.isPending ? t('auth.loggingIn') : t('auth.login')}
        </Button>
      </form>
    </div>
  );
}
