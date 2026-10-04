import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FormFieldProps {
  label: string;
  /** Must equal the `id` of the input inside `children`. */
  name: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export default function FormField({ label, name, error, required, className, children }: FormFieldProps) {
  const { t } = useTranslation();
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={name} className="text-sm font-semibold text-fg">
        {label}
        {required && (
          <span className="ms-1 text-danger" title={t('common.required')} aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {/* Reserved slot so an error appearing doesn't shift the form. */}
      <div className="min-h-5" id={`${name}-error`}>
        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-danger">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
