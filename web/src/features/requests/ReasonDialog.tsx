import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUEST_LIMITS } from '@/api/requests';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import TextareaInput from '@/components/ui/TextareaInput';

interface Props {
  open: boolean;
  loading?: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}

/** Cancelling needs a real reason (the server refuses an empty one; legacy blocked it here too). */
export default function ReasonDialog({ open, loading, onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const empty = reason.trim() === '';

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
      title={t('requests.cancelDialog.title')}
      widthClass="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={submit} loading={loading}>
            {t('requests.cancelDialog.submit')}
          </Button>
        </>
      }
    >
      <label htmlFor="cancel-reason" className="mb-1.5 block text-sm font-semibold text-slate-700">
        {t('requests.cancelDialog.label')}
      </label>
      <TextareaInput
        id="cancel-reason"
        rows={3}
        autoFocus
        value={reason}
        maxLength={REQUEST_LIMITS.cancelReason}
        hasError={touched && empty}
        placeholder={t('requests.cancelDialog.placeholder')}
        onChange={(e) => setReason(e.target.value)}
      />
      {touched && empty && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600">
          {t('requests.cancelDialog.required')}
        </p>
      )}
    </Modal>
  );
}
