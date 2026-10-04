import clsx from 'clsx';
import { CircleCheck, CirclePause, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ListingKind, ListingState } from '@/api/myListings';
import { LISTING_STATES } from './model';

const ICON = { 0: CircleCheck, 1: CirclePause, 2: EyeOff } as const;
const ON = {
  0: 'bg-ok-soft text-ok ring-ok-line',
  1: 'bg-warn-soft text-warn ring-warn-line',
  2: 'bg-subtle text-fg ring-line-strong',
} as const;

/** Available / not available now / withdrawn, as one segmented choice, with what the chosen one means for the public. */
export default function StatePicker({
  value,
  kind,
  onChange,
  disabled,
  name,
}: {
  value: ListingState;
  kind: ListingKind;
  onChange: (s: ListingState) => void;
  disabled?: boolean;
  /** Radio group name (unique per listing). */
  name: string;
}) {
  const { t } = useTranslation();
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="sr-only">{t('myListings.state.label')}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-subtle p-1">
        {LISTING_STATES.map((s) => {
          const Icon = ICON[s];
          const on = value === s;
          return (
            <label
              key={s}
              className={clsx(
                'flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-1.5 text-center text-xs font-bold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand sm:text-sm',
                on ? `ring-1 ${ON[s]}` : 'text-muted hover:text-fg',
              )}
            >
              <input type="radio" name={name} className="sr-only" checked={on} onChange={() => onChange(s)} />
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {t(`myListings.state.${s}`)}
            </label>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-muted">{t(`myListings.state.hint.${kind}.${value}`)}</p>
    </fieldset>
  );
}
