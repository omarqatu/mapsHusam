import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import Pressable from './Pressable';
import { CHIP_TONE, type ChipTone } from './tones';

/** A live number on a card. `loading` shows a placeholder of the same size so the card does not jump. */
export type CardFigure =
  | 'loading'
  | { value: string | number; label?: string; tone?: 'ok' | 'warn' | 'danger' };

const figureTone = { ok: 'text-ok', warn: 'text-warn', danger: 'text-danger' } as const;

interface Props {
  icon: LucideIcon;
  tone: ChipTone;
  title: string;
  description: string;
  figure?: CardFigure;
  to?: string;
  onClick?: () => void;
}

/**
 * One entrance of the home page. Anatomy, the same for every card: icon chip and live figure on the first row, then
 * the title with an arrow, then one line saying what is behind it. The whole card is the target.
 */
export default function HomeCard({ icon: Icon, tone, title, description, figure, to, onClick }: Props) {
  return (
    <Pressable
      to={to}
      onClick={onClick}
      className={clsx(
        'group flex h-full min-h-40 w-full flex-col rounded-2xl border border-line bg-surface p-4 text-start shadow-card',
        'transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-float',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', CHIP_TONE[tone])}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        {figure === 'loading' && <span className="mt-1 h-8 w-16 animate-pulse rounded-lg bg-subtle-2" aria-hidden />}
        {figure && figure !== 'loading' && (
          <span className="flex flex-col items-end text-end">
            <span className={clsx('text-2xl font-black leading-none', figure.tone ? figureTone[figure.tone] : 'text-fg')}>
              {figure.value}
            </span>
            {figure.label && <span className="mt-1 text-sm text-muted">{figure.label}</span>}
          </span>
        )}
      </span>
      <span className="mt-3 flex items-center gap-2">
        <span className="text-lg font-bold text-fg">{title}</span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:text-brand-fg ltr:group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
          aria-hidden
        />
      </span>
      <span className="mt-1 text-sm leading-relaxed text-muted">{description}</span>
    </Pressable>
  );
}
