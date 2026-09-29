import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SelectInput, { type SelectOption } from '@/components/ui/SelectInput';
import { ALL_TARGETS, targetFromKey, targetKey, targetLabelKey, type MapTarget } from '../targets';

interface Props {
  id: string;
  value: MapTarget | null;
  onChange: (t: MapTarget | null) => void;
  className?: string;
}

/** Real-estate + service types (grouped, services A–Z in the UI language) with a filter box — 70+ options. */
export default function TargetSelect({ id, value, onChange, className }: Props) {
  const { t, i18n } = useTranslation();
  const options = useMemo<SelectOption[]>(() => {
    const label = (x: MapTarget) => t(targetLabelKey(x));
    const re = ALL_TARGETS.filter((x) => x.kind === 'realEstate').map((x) => ({
      value: targetKey(x),
      label: label(x),
      group: t('map.realEstate'),
    }));
    const services = ALL_TARGETS.filter((x) => x.kind === 'service')
      .map((x) => ({ value: targetKey(x), label: label(x), group: t('map.services') }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language));
    return [...re, ...services];
  }, [t, i18n.language]);

  return (
    <SelectInput
      id={id}
      className={className}
      searchable
      value={value ? targetKey(value) : ''}
      onChange={(e) => onChange(targetFromKey(e.target.value))}
      placeholder={t('search.chooseType')}
      options={options}
    />
  );
}
