import type { Ref, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

export interface TextareaInputProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
  ref?: Ref<HTMLTextAreaElement>;
}

const sizes = { sm: 'px-3 py-2 text-sm', md: 'px-3.5 py-2.5 text-base', lg: 'px-4 py-3 text-base' } as const;

/** Multi-line twin of `TextInput` (same borders, focus ring and error state; same API as the water platform's). */
export default function TextareaInput({
  hasError,
  inputSize = 'md',
  className,
  ref,
  ...rest
}: TextareaInputProps) {
  return (
    <textarea
      ref={ref}
      aria-invalid={hasError || undefined}
      className={clsx(
        'w-full resize-none rounded-lg border bg-white text-slate-800 placeholder:text-slate-400',
        'focus:border-brand focus:outline-2 focus:outline-brand/30',
        'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
        hasError ? 'border-red-400' : 'border-slate-300',
        sizes[inputSize],
        className,
      )}
      {...rest}
    />
  );
}
