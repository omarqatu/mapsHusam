import { FilterX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/FilterField';
import SearchInput from '@/components/ui/SearchInput';
import SelectInput, { type SelectOption } from '@/components/ui/SelectInput';
import TextInput from '@/components/ui/TextInput';
import { hasFilters, NO_FILTERS, type UserFilters } from '../model';

interface Props {
  value: UserFilters;
  onChange: (next: UserFilters) => void;
}

/** Search + five drop-downs + the exact-day picker (legacy filter bar). Every change applies immediately. */
export default function UserFiltersBar({ value, onChange }: Props) {
  const { t } = useTranslation();
  const set = <K extends keyof UserFilters>(key: K, v: UserFilters[K]) => onChange({ ...value, [key]: v });
  const all = { value: '', label: t('adminUsers.filters.all') };
  const opts = (prefix: string, keys: string[]): SelectOption[] => [
    all,
    ...keys.map((k) => ({ value: k, label: t(`${prefix}.${k}`) })),
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        <div className="sm:col-span-2 lg:col-span-3 xl:col-span-2">
          <Field label={t('adminUsers.filters.search')}>
            <SearchInput
              value={value.search}
              onChange={(v) => set('search', v)}
              placeholder={t('adminUsers.filters.searchPlaceholder')}
              debounceMs={200}
            />
          </Field>
        </div>
        <Field label={t('adminUsers.filters.role')}>
          <SelectInput
            aria-label={t('adminUsers.filters.role')}
            value={value.role}
            onChange={(e) => set('role', e.target.value as UserFilters['role'])}
            options={[
              all,
              ...(['admin', 'provider', 'user'] as const).map((r) => ({ value: r, label: t(`roles.${r}`) })),
            ]}
          />
        </Field>
        <Field label={t('adminUsers.filters.active')}>
          <SelectInput
            aria-label={t('adminUsers.filters.active')}
            value={value.active}
            onChange={(e) => set('active', e.target.value as UserFilters['active'])}
            options={opts('adminUsers.filters.activeOptions', ['active', 'inactive'])}
          />
        </Field>
        <Field label={t('adminUsers.filters.online')}>
          <SelectInput
            aria-label={t('adminUsers.filters.online')}
            value={value.online}
            onChange={(e) => set('online', e.target.value as UserFilters['online'])}
            options={opts('adminUsers.filters.onlineOptions', ['online', 'offline'])}
          />
        </Field>
        <Field label={t('adminUsers.filters.linked')}>
          <SelectInput
            aria-label={t('adminUsers.filters.linked')}
            value={value.linked}
            onChange={(e) => set('linked', e.target.value as UserFilters['linked'])}
            options={opts('adminUsers.filters.linkedOptions', ['linked', 'unlinked'])}
          />
        </Field>
        <Field label={t('adminUsers.filters.created')}>
          <SelectInput
            aria-label={t('adminUsers.filters.created')}
            value={value.date}
            onChange={(e) =>
              onChange({ ...value, date: e.target.value as UserFilters['date'], customDate: '' })
            }
            options={opts('adminUsers.filters.createdOptions', ['2days', 'week', 'month', 'custom'])}
          />
        </Field>
        {value.date === 'custom' && (
          <Field label={t('adminUsers.filters.customDate')}>
            <TextInput
              type="date"
              aria-label={t('adminUsers.filters.customDate')}
              value={value.customDate}
              onChange={(e) => set('customDate', e.target.value)}
            />
          </Field>
        )}
      </div>
      {hasFilters(value) && (
        <Button
          size="sm"
          variant="secondary"
          startIcon={<FilterX className="h-4 w-4" />}
          onClick={() => onChange(NO_FILTERS)}
        >
          {t('common.clearFilters')}
        </Button>
      )}
    </div>
  );
}
