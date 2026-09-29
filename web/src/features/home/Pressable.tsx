import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** A link when it goes to a page, a button when it opens something in place. Same look either way. */
export default function Pressable({
  to,
  onClick,
  className,
  children,
}: {
  to?: string;
  onClick?: () => void;
  className: string;
  children: ReactNode;
}) {
  if (to)
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
