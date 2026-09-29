import { FilterX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import FilterField from '@/components/ui/FilterField';
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

/** The column filters of the legacy table header, laid out as a labelled grid (a header row can't work on a phone). */
export default function StatsFilters({ value, onChange, users, providers, reasons, layers }: Props) {
  const { t } = useTranslation();
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
  const moreActive = !!(
    value.phone ||
    value.reason ||
    value.usernameExact ||
    value.providerExact ||
    value.reasonExact
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {text('username', t('adminDashboard.col.user'), t('adminDashboard.filters.userPlaceholder'))}
        {text('provider', t('adminDashboard.col.provider'), t('adminDashboard.filters.providerPlaceholder'))}
        <FilterField label={t('adminDashboard.col.layer')}>
          <SelectInput
            searchable
            aria-label={t('adminDashboard.col.layer')}
            value={value.layer}
            onChange={(e) => set('layer', e.target.value)}
            options={[{ value: '', label: t('adminDashboard.filters.allLayers') }, ...layers]}
          />
        </FilterField>
        <FilterField label={t('adminDashboard.col.contact')}>
          <SelectInput
            aria-label={t('adminDashboard.col.contact')}
            value={value.contact}
            onChange={(e) => set('contact', e.target.value as StatFilters['contact'])}
            options={[
              all,
              ...(['service_request', 'call', 'whatsapp'] as const).map((k) => ({
                value: k,
                label: t(`adminDashboard.contact.${k}`),
              })),
            ]}
          />
        </FilterField>
        <FilterField label={t('adminDashboard.col.status')}>
          <SelectInput
            aria-label={t('adminDashboard.col.status')}
            value={value.status}
            onChange={(e) => set('status', e.target.value as StatFilters['status'])}
            options={[
              all,
              ...(['success', 'pending', 'cancelled'] as const).map((k) => ({
                value: k,
                label: t(`adminDashboard.status.${k}`),
              })),
            ]}
          />
        </FilterField>
        <FilterField label={t('adminDashboard.filters.dayPicker')}>
          <TextInput
            type="date"
            aria-label={t('adminDashboard.filters.dayPicker')}
            onChange={(e) => set('date', toTypedDate(e.target.value))}
            value={toIso(value.date)}
          />
        </FilterField>
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
      <details open={moreActive || undefined} className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          {t('adminDashboard.filters.more')}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {text('phone', t('adminDashboard.col.phone'), t('adminDashboard.filters.phonePlaceholder'), true)}
          {text('reason', t('adminDashboard.col.reason'), t('adminDashboard.filters.reasonPlaceholder'))}
          {exact('usernameExact', t('adminDashboard.filters.userExact'), users)}
          {exact('providerExact', t('adminDashboard.filters.providerExact'), providers)}
          {exact('reasonExact', t('adminDashboard.filters.reasonExact'), reasons)}
        </div>
      </details>
      {hasStatFilters(value) && (
        <Button
          size="sm"
          variant="secondary"
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
