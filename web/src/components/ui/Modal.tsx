import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons row, rendered in the footer. */
  footer?: ReactNode;
  /** Tailwind max-width class, default `max-w-lg`. */
  widthClass?: string;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = 'max-w-lg',
}: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); // handled here — sheets underneath must not close too
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fg/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx('flex max-h-full w-full flex-col rounded-2xl bg-surface shadow-xl', widthClass)}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line p-4">
          <h2 id={titleId} className="text-lg font-bold text-fg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded p-1 text-muted hover:bg-subtle"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line p-4">{footer}</footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
