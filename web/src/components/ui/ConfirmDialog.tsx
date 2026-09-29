import { useTranslation } from 'react-i18next';
import Button from './Button';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for destructive actions (delete). */
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onCancel}
      title={title}
      widthClass="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <p className="text-slate-600">{message}</p>
    </Modal>
  );
}
