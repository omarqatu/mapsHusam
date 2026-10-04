import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Minus } from 'lucide-react';
import clsx from 'clsx';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  /** Visible text; without it pass `aria-label`. */
  label?: ReactNode;
  /** Some but not all of a group are checked (select-all headers). */
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
}

/** Checkbox with a 20 px box and (optionally) a label that is part of the click target. */
export default function Checkbox({
  label,
  indeterminate,
  onChange,
  className,
  disabled,
  ...rest
}: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <label
      className={clsx(
        'inline-flex items-center gap-2 text-sm font-medium text-fg',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : undefined}
        onChange={(e) => onChange?.(e.target.checked)}
        className="peer sr-only"
        {...rest}
      />
      <span
        aria-hidden
        className={clsx(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-line-strong bg-surface shadow-sm transition-colors after:hidden after:h-2.5 after:w-1.5 after:-translate-y-px after:rotate-45 after:border-b-2 after:border-e-2 after:border-white after:content-[''] peer-checked:border-brand peer-checked:bg-brand peer-checked:after:block peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
          indeterminate && 'border-brand bg-brand after:!hidden',
        )}
      >
        {indeterminate && <Minus className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
}
