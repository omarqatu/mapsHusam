import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_TARGETS, targetFromKey, targetKey, targetLabelKey, type SearchTarget } from './model';

interface Props {
  id: string;
  value: SearchTarget | null;
  onChange: (t: SearchTarget | null) => void;
  className?: string;
}

/** Real-estate + service types in one native select (best picker on phones), grouped, services A–Z in the UI language. */
export default function TargetSelect({ id, value, onChange, className }: Props) {
  const { t, i18n } = useTranslation();
  const groups = useMemo(() => {
    const label = (x: SearchTarget) => t(targetLabelKey(x));
    const realEstate = ALL_TARGETS.filter((x) => x.kind === 'realEstate');
    const services = ALL_TARGETS.filter((x) => x.kind === 'service').sort((a, b) =>
      label(a).localeCompare(label(b), i18n.language),
    );
    return { realEstate, services, label };
  }, [t, i18n.language]);

  return (
    <select
      id={id}
      value={value ? targetKey(value) : ''}
      onChange={(e) => onChange(targetFromKey(e.target.value))}
      className={`h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-800 focus:border-brand focus:outline-2 focus:outline-brand/30 ${className ?? ''}`}
    >
      <option value="">{t('search.chooseType')}</option>
      <optgroup label={t('map.realEstate')}>
        {groups.realEstate.map((x) => (
          <option key={targetKey(x)} value={targetKey(x)}>
            {groups.label(x)}
          </option>
        ))}
      </optgroup>
      <optgroup label={t('map.services')}>
        {groups.services.map((x) => (
          <option key={targetKey(x)} value={targetKey(x)}>
            {groups.label(x)}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
