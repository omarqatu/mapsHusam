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
        <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted">
          {startIcon}
        </span>
      )}
      <input
        ref={ref}
        aria-invalid={hasError || undefined}
        className={clsx(
          'w-full rounded-lg border bg-surface px-3.5 text-fg placeholder:text-muted',
          'focus:border-brand focus:outline-2 focus:outline-brand/30',
          'disabled:bg-subtle disabled:text-muted',
          hasError ? 'border-danger-solid' : 'border-line-strong',
          startIcon && 'ps-10',
          endIcon && 'pe-10',
          sizes[inputSize],
          className,
        )}
        {...rest}
      />
      {endIcon && (
        <span className="absolute inset-y-0 end-3 flex items-center text-muted">{endIcon}</span>
      )}
    </div>
  );
}
