import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonClass';
import { Spinner } from './Spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button (use for pending mutations). */
  loading?: boolean;
  startIcon?: ReactNode;
}

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
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading ? <Spinner size="sm" className="border-white/40 border-t-white" /> : startIcon}
      {children}
    </button>
  );
}
