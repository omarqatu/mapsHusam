import { useState } from 'react';
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
}: {
  keys?: LegalKey[];
  className?: string;
  linkClassName?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<LegalKey | null>(null);
  return (
    <>
      <ul className={clsx('flex flex-wrap items-center justify-center gap-x-4 gap-y-1', className)}>
        {keys.map((k) => (
          <li key={k}>
            <button
              type="button"
              onClick={() => setOpen(k)}
              className={clsx('text-sm font-semibold underline-offset-2 hover:underline', linkClassName)}
            >
              {t(`auth.legal.${k}`)}
            </button>
          </li>
        ))}
      </ul>
      <LegalModal docKey={open} onClose={() => setOpen(null)} />
    </>
  );
}
