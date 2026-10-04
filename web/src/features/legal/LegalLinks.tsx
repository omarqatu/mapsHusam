import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import LegalModal from './LegalModal';
import { AUTH_LEGAL_KEYS } from './legalKeys';
import type { LegalKey } from './types';

/** Text buttons that open a legal text in a dialog (terms / privacy / guide by default). */
export default function LegalLinks({
  keys = AUTH_LEGAL_KEYS,
  className,
  linkClassName,
  layout = 'center',
  leading,
}: {
  keys?: LegalKey[];
  className?: string;
  linkClassName?: string;
  /** `center` (default) / `start`: a wrapping row; `column`: a vertical list. */
  layout?: 'center' | 'start' | 'column';
  /** Shown before every link (the footer's small arrow). */
  leading?: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<LegalKey | null>(null);
  return (
    <>
      <ul
        className={clsx(
          layout === 'column' && 'flex flex-col items-start gap-2',
          layout !== 'column' && 'flex flex-wrap items-center gap-x-4 gap-y-1',
          layout === 'center' && 'justify-center',
          className,
        )}
      >
        {keys.map((k) => (
          <li key={k}>
            <button
              type="button"
              onClick={() => setOpen(k)}
              className={clsx(
                'text-sm font-semibold underline-offset-2 hover:underline',
                leading && 'inline-flex items-center gap-1.5',
                linkClassName,
              )}
            >
              {leading}
              {t(`auth.legal.${k}`)}
            </button>
          </li>
        ))}
      </ul>
      <LegalModal docKey={open} onClose={() => setOpen(null)} />
    </>
  );
}
