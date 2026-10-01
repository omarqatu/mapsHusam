import { useState } from 'react';
import clsx from 'clsx';
import { FilterX, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import FilterField from '@/components/ui/FilterField';
import SearchInput from '@/components/ui/SearchInput';
import SelectInput, { type SelectOption } from '@/components/ui/SelectInput';
import TextInput from '@/components/ui/TextInput';
import { hasStatFilters, NO_STAT_FILTERS, normalizeDigits, toTypedDate, type StatFilters } from './model';

interface Props {
  value: StatFilters;
  onChange: (next: StatFilters) => void;
  users: string[];
  providers: string[];
  reasons: string[];
  layers: SelectOption[];
}

/** The filters that stay folded until asked for: the legacy per-column boxes and exact-match lists. */
const MORE: (keyof StatFilters)[] = [
  'username',
  'provider',
  'phone',
  'reason',
  'usernameExact',
  'providerExact',
  'reasonExact',
];

/**
 * One toolbar: a search box over the text columns, the service, the contact type and the day; the legacy column filters
 * (contains / exact match, typed day) behind "more filters". The status filter is the row of tiles above.
 */
export default function StatsFilters({ value, onChange, users, providers, reasons, layers }: Props) {
  const { t } = useTranslation();
  const moreCount = MORE.filter((k) => value[k] !== '').length;
  const [moreOpen, setMoreOpen] = useState(moreCount > 0);
  const set = <K extends keyof StatFilters>(key: K, v: StatFilters[K]) => onChange({ ...value, [key]: v });
  const all = { value: '', label: t('adminDashboard.filters.all') };
  const fromList = (list: string[]): SelectOption[] => [all, ...list.map((v) => ({ value: v, label: v }))];

  const text = (
    key: 'username' | 'provider' | 'phone' | 'reason',
    label: string,
    placeholder: string,
    ltr = false,
  ) => (
    <FilterField label={label}>
      <TextInput
        aria-label={label}
        dir={ltr ? 'ltr' : undefined}
        value={value[key]}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)}
      />
    </FilterField>
  );
  const exact = (key: 'usernameExact' | 'providerExact' | 'reasonExact', label: string, list: string[]) => (
    <FilterField label={label}>
      <SelectInput
        searchable
        aria-label={label}
        value={value[key]}
        onChange={(e) => set(key, e.target.value)}
        options={fromList(list)}
      />
    </FilterField>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
        <SearchInput
          className="sm:col-span-2 lg:col-span-1"
          value={value.q}
          onChange={(q) => set('q', q)}
          placeholder={t('adminDashboard.filters.search')}
        />
        <SelectInput
          searchable
          aria-label={t('adminDashboard.col.layer')}
          value={value.layer}
          onChange={(e) => set('layer', e.target.value)}
          options={[{ value: '', label: t('adminDashboard.filters.allLayers') }, ...layers]}
        />
        <SelectInput
          aria-label={t('adminDashboard.col.contact')}
          value={value.contact}
          onChange={(e) => set('contact', e.target.value as StatFilters['contact'])}
          options={[
            { value: '', label: t('adminDashboard.filters.allContacts') },
            ...(['service_request', 'call', 'whatsapp'] as const).map((k) => ({
              value: k,
              label: t(`adminDashboard.contact.${k}`),
            })),
          ]}
        />
        <TextInput
          type="date"
          aria-label={t('adminDashboard.filters.dayPicker')}
          title={t('adminDashboard.filters.dayPicker')}
          onChange={(e) => set('date', toTypedDate(e.target.value))}
          value={toIso(value.date)}
        />
        <Button
          variant="secondary"
          aria-expanded={moreOpen}
          aria-controls="dashboard-more-filters"
          startIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
          onClick={() => setMoreOpen((v) => !v)}
          className={clsx(moreCount > 0 && 'border-brand text-brand-fg')}
        >
          {moreCount > 0
            ? t('adminDashboard.filters.moreCount', { count: moreCount })
            : t('adminDashboard.filters.more')}
        </Button>
      </div>

      {moreOpen && (
        <div
          id="dashboard-more-filters"
          className="grid grid-cols-1 gap-3 rounded-xl bg-subtle p-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {text('username', t('adminDashboard.col.user'), t('adminDashboard.filters.userPlaceholder'))}
          {text(
            'provider',
            t('adminDashboard.col.provider'),
            t('adminDashboard.filters.providerPlaceholder'),
          )}
          {text('phone', t('adminDashboard.col.phone'), t('adminDashboard.filters.phonePlaceholder'), true)}
          {text('reason', t('adminDashboard.col.reason'), t('adminDashboard.filters.reasonPlaceholder'))}
          {exact('usernameExact', t('adminDashboard.filters.userExact'), users)}
          {exact('providerExact', t('adminDashboard.filters.providerExact'), providers)}
          {exact('reasonExact', t('adminDashboard.filters.reasonExact'), reasons)}
          <FilterField label={t('adminDashboard.filters.dayTyped')}>
            <TextInput
              dir="ltr"
              inputMode="numeric"
              aria-label={t('adminDashboard.filters.dayTyped')}
              placeholder="22/08/2026"
              value={value.date}
              onChange={(e) => set('date', normalizeDigits(e.target.value))}
            />
          </FilterField>
        </div>
      )}

      {hasStatFilters(value) && (
        <Button
          size="sm"
          variant="ghost"
          startIcon={<FilterX className="h-4 w-4" />}
          onClick={() => onChange(NO_STAT_FILTERS)}
        >
          {t('common.clearFilters')}
        </Button>
      )}
    </div>
  );
}

/** `dd/mm/yyyy` → `yyyy-mm-dd` for the date input ('' while the typed text is incomplete). */
function toIso(typed: string): string {
  const m = typed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}
