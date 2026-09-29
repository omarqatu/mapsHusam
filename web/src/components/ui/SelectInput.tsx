import type { Ref, SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectInputProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[];
  /** Adds an empty first option with this label. */
  placeholder?: string;
  hasError?: boolean;
  ref?: Ref<HTMLSelectElement>;
}

export default function SelectInput({
  options,
  placeholder,
  hasError,
  className,
  ref,
  ...rest
}: SelectInputProps) {
  return (
    <select
      ref={ref}
      aria-invalid={hasError || undefined}
      className={clsx(
        'h-11 w-full rounded-lg border bg-white px-3 text-base text-slate-800',
        'focus:border-brand focus:outline-2 focus:outline-brand/30 disabled:bg-slate-100',
        hasError ? 'border-red-400' : 'border-slate-300',
        className,
      )}
      {...rest}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
