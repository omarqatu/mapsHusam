import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SelectInput, { type SelectOption } from '@/components/ui/SelectInput';
import { useShownTargets } from '@/features/visibility/store';
import { groupedTargets } from '../extras/featured';
import { groupLabelKey } from '../registry';
import { targetFromKey, targetKey, targetLabelKey, type MapTarget } from '../targets';

interface Props {
  id: string;
  value: MapTarget | null;
  onChange: (t: MapTarget | null) => void;
  className?: string;
}

/** Real-estate + service types grouped like the category browser, with a filter box. */
export default function TargetSelect({ id, value, onChange, className }: Props) {
  const { t, i18n } = useTranslation();
  const targets = useShownTargets();
  const options = useMemo<SelectOption[]>(() => {
    const label = (x: MapTarget) => t(targetLabelKey(x));
    const shown = new Set(targets.map(targetKey));
    return groupedTargets().flatMap(({ group, targets: groupTargets }) =>
      groupTargets
        .filter((x) => shown.has(targetKey(x)))
        .map((x) => ({ value: targetKey(x), label: label(x), group: t(groupLabelKey(group)) }))
        .sort((a, b) => a.label.localeCompare(b.label, i18n.language)),
    );
  }, [t, i18n.language, targets]);

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
