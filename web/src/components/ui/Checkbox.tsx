import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
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
        onChange={(e) => onChange?.(e.target.checked)}
        className="h-5 w-5 shrink-0 cursor-[inherit] rounded border-line-strong accent-brand"
        {...rest}
      />
      {label}
    </label>
  );
}
