import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUEST_LIMITS } from '@/api/requests';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import TextareaInput from '@/components/ui/TextareaInput';

interface Props {
  open: boolean;
  loading?: boolean;
  intent?: 'cancel' | 'reject';
  onSubmit: (reason: string) => void;
  onClose: () => void;
}

/** Cancelling or declining a request needs a real reason, also enforced by the server. */
export default function ReasonDialog({ open, loading, intent = 'cancel', onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const empty = reason.trim() === '';
  const key = intent === 'reject' ? 'requests.rejectDialog' : 'requests.cancelDialog';
  const inputId = `${intent}-reason`;

  const close = () => {
    setReason('');
    setTouched(false);
    onClose();
  };
  const submit = () => {
    if (empty) return setTouched(true);
    onSubmit(reason.trim());
  };

  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : close}
      title={t(`${key}.title`)}
      widthClass="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={submit} loading={loading}>
            {t(`${key}.submit`)}
          </Button>
        </>
      }
    >
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-fg">
        {t(`${key}.label`)}
      </label>
      <TextareaInput
        id={inputId}
        rows={3}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the dialog was just opened by the user; focus goes to its only field
        autoFocus
        value={reason}
        maxLength={REQUEST_LIMITS.cancelReason}
        hasError={touched && empty}
        placeholder={t(`${key}.placeholder`)}
        onChange={(e) => setReason(e.target.value)}
      />
      {touched && empty && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">
          {t(`${key}.required`)}
        </p>
      )}
    </Modal>
  );
}
