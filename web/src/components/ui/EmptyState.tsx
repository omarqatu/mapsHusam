import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted">
      <div className="text-line-strong">{icon ?? <Inbox className="h-10 w-10" aria-hidden />}</div>
      <p className="font-semibold text-fg">{title}</p>
      {description && <p className="max-w-sm text-sm">{description}</p>}
      {action}
    </div>
  );
}
