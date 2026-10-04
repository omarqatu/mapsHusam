import clsx from 'clsx';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HOUR_PRESETS } from './model';

/** Ready choices for a service's work hours, as chips above the free text field. */
export default function HourPresets({ value, onChange }: { value: string; onChange: (hours: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {HOUR_PRESETS.map((h) => (
        <button
          key={h}
          type="button"
          aria-pressed={value === h}
          onClick={() => onChange(h)}
          className={clsx(
            'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold',
            value === h ? 'border-brand bg-brand-light text-brand-fg' : 'border-line text-fg hover:bg-subtle',
          )}
        >
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {t(`myListings.editor.presets.${h}`)}
        </button>
      ))}
    </div>
  );
}
