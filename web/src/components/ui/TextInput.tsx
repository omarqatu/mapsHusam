import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import clsx from 'clsx';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  /** Icon at the start edge (right in RTL, left in LTR). */
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
  ref?: Ref<HTMLInputElement>;
}

const sizes = { sm: 'h-9 text-sm', md: 'h-11 text-base', lg: 'h-[3.25rem] text-base' } as const;

export default function TextInput({
  hasError,
  startIcon,
  endIcon,
  inputSize = 'md',
  className,
  ref,
  ...rest
}: TextInputProps) {
  return (
    <div className="relative">
      {startIcon && (
        <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-slate-400">
          {startIcon}
        </span>
      )}
      <input
        ref={ref}
        aria-invalid={hasError || undefined}
        className={clsx(
          'w-full rounded-lg border bg-white px-3.5 text-slate-800 placeholder:text-slate-400',
          'focus:border-brand focus:outline-2 focus:outline-brand/30',
          'disabled:bg-slate-100 disabled:text-slate-500',
          hasError ? 'border-red-400' : 'border-slate-300',
          startIcon && 'ps-10',
          endIcon && 'pe-10',
          sizes[inputSize],
          className,
        )}
        {...rest}
      />
      {endIcon && (
        <span className="absolute inset-y-0 end-3 flex items-center text-slate-400">{endIcon}</span>
      )}
    </div>
  );
}
