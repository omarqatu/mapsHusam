import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useChangePassword } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Modal from '@/components/ui/Modal';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import { MIN_PASSWORD_LENGTH } from './phone';

const FACEBOOK_PAGE = 'https://www.facebook.com/MapServesPalestine';

/** Legacy `changeUserPassword()`. The server rotates the token; `apiRequest` stores the new one. */
export default function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <Dialog onClose={onClose} />;
}

function Dialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.user_id);
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (userId === undefined) return;
    const found: typeof errors = {};
    if (!current.trim()) found.current = t('auth.changePassword.currentEmpty');
    if (next.trim().length < MIN_PASSWORD_LENGTH) found.next = t('auth.changePassword.newShort');
    setErrors(found);
    if (Object.keys(found).length) return;
    change.mutate(
      { userId, currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          toast.success(t('auth.changePassword.success'));
          onClose();
        },
      },
    );
  };

  const errorMessage =
    change.error instanceof ApiError
      ? change.error.status === 0
        ? t('errors.network')
        : change.error.message
      : change.error
        ? t('errors.generic')
        : '';

  return (
    <Modal
      open
      onClose={onClose}
      title={t('auth.changePassword.title')}
      widthClass="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="change-password-form" loading={change.isPending}>
            {change.isPending ? t('auth.changePassword.submitting') : t('auth.changePassword.submit')}
          </Button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={submit} noValidate>
        <AlertMessage type="error" message={errorMessage} className="mb-3" />
        <FormField
          label={t('auth.changePassword.current')}
          name="current-password"
          required
          error={errors.current}
        >
          <TextInput
            id="current-password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            hasError={!!errors.current}
          />
        </FormField>
        <FormField label={t('auth.changePassword.new')} name="new-password" required error={errors.next}>
          <TextInput
            id="new-password"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            maxLength={128}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            hasError={!!errors.next}
          />
        </FormField>
        <p className="rounded-lg border-s-4 border-info-solid bg-subtle p-2 text-xs leading-5 text-muted">
          {t('auth.changePassword.trouble')}{' '}
          <a
            href={FACEBOOK_PAGE}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-fg underline"
          >
            {t('auth.changePassword.facebookPage')}
          </a>
        </p>
      </form>
    </Modal>
  );
}
