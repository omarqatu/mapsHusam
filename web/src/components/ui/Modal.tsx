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
  /** On phones, rise from the bottom edge as a sheet (thumb reach) instead of floating in the middle. */
  sheetOnPhone?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = 'max-w-lg',
  sheetOnPhone,
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
    <div className={clsx('fixed inset-0 z-50 flex justify-center', sheetOnPhone ? 'items-end sm:items-center sm:p-4' : 'items-center p-4')}>
      {/* Click-outside is a pointer convenience on a decorative layer behind the dialog; the keyboard closes with Escape
          (above) and with the close button. */}
      <div aria-hidden="true" className="absolute inset-0 bg-fg/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx(
          'relative flex w-full flex-col bg-surface shadow-xl',
          sheetOnPhone
            ? 'max-h-[92dvh] rounded-t-3xl motion-safe:animate-[rise_0.25s_ease-out] sm:max-h-full sm:rounded-2xl'
            : 'max-h-full rounded-2xl',
          widthClass,
        )}
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
