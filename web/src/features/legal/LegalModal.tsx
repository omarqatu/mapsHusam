import { useTranslation } from 'react-i18next';
import Modal from '@/components/ui/Modal';
import LegalDocView from './LegalDocView';
import { legalTitleIcons } from './legalIcons';
import { useLegalDoc } from './useLegalDoc';
import type { LegalKey } from './types';

/** The legacy `openAppLegalModal(key)`: a dialog over whatever page the visitor is on (the register form keeps its input). */
export default function LegalModal({ docKey, onClose }: { docKey: LegalKey | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { doc } = useLegalDoc(docKey);
  if (!doc) return null;
  const Icon = legalTitleIcons[doc.icon];
  return (
    <Modal
      open
      onClose={onClose}
      title={doc.title}
      widthClass="max-w-2xl"
      footer={
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted">
          {t('common.close')}
        </button>
      }
    >
      <div className="mb-3 flex items-center gap-2 text-brand-fg">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <LegalDocView doc={doc} />
    </Modal>
  );
}
