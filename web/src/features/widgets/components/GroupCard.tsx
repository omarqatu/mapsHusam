import type { ReactNode } from 'react';
import clsx from 'clsx';
import SectionCard from '@/components/ui/SectionCard';

/**
 * One of the ten information cards: SectionCard with a coloured icon tile and the "last update" line under the title.
 * `id` is the deep-link anchor (`#card-<id>`); `scroll-mt` keeps it clear of the sticky header when scrolled to.
 */
export default function GroupCard({
  id,
  title,
  icon,
  chip,
  subtitle,
  children,
  className,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  /** Tailwind bg / text classes of the icon tile. */
  chip: string;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <SectionCard
      id={id}
      title={title}
      icon={
        <span className={clsx('flex h-10 w-10 items-center justify-center rounded-xl', chip)}>{icon}</span>
      }
      subtitle={subtitle}
      className={clsx('scroll-mt-32 target:ring-2 target:ring-brand/40', className)}
    >
      {children}
    </SectionCard>
  );
}
