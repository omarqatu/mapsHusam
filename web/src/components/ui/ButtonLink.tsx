import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonClass';

/** A link (a page change) that looks like a Button — never a Button inside a Link. */
export default function ButtonLink({
  variant,
  size,
  startIcon,
  className,
  children,
  ...rest
}: LinkProps & { variant?: ButtonVariant; size?: ButtonSize; startIcon?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {startIcon}
      {children}
    </Link>
  );
}
