import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'whatsapp';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables the button (use for pending mutations). */
  loading?: boolean;
  startIcon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-subtle',
  danger: 'bg-danger-solid text-white hover:bg-danger-solid',
  ghost: 'text-fg hover:bg-subtle',
  whatsapp: 'bg-whatsapp text-white hover:bg-whatsapp-hover',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-[3.25rem] px-5 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading,
  startIcon,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" className="border-white/40 border-t-white" /> : startIcon}
      {children}
    </button>
  );
}
