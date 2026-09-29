import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { ListFilter, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import SelectInput from '@/components/ui/SelectInput';
import TextInput from '@/components/ui/TextInput';
import { OPERATOR_SYMBOL, type FieldDef } from '../map/search/model';
import type { MapTarget } from '../map/targets';
import {
  CURRENCIES,
  DEFAULT_RANGE_OPERATOR,
  RANGE_OPERATORS,
  countActive,
  filterFields,
  setFilter,
  toConditions,
  type FilterState,
} from './filters';
import { useUniqueValues } from './queries';
import type { SearchOperator } from '@/api/search';

const TYPE_DELAY_MS = 300; // legacy debounce for typed values

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

interface CommonProps {
  target: MapTarget;
  state: FilterState;
  onChange: (next: FilterState) => void;
  fields: FieldDef[];
}

function DropdownFilter({ field, target, state, onChange, fields }: CommonProps & { field: FieldDef }) {
  const { t } = useTranslation();
  const id = useId();
  const values = useUniqueValues(target, field.id, toConditions(state, fields));
  const current = state.values[field.id]?.value ?? '';
  const options = [
    { value: '', label: t('searchPage.all') },
    ...(values.data ?? []).map((v) => ({ value: v, label: v })),
    // A value from a shared link that the (narrowed) list no longer contains must still show as selected.
    ...(current && !(values.data ?? []).includes(current) ? [{ value: current, label: current }] : []),
  ];
  return (
    <Field label={t(field.labelKey)} id={id}>
      <SelectInput
        id={id}
        searchable
        value={current}
        onChange={(e) => onChange(setFilter(state, fields, field.id, { value: e.target.value }))}
        options={options}
        placeholder={values.isLoading ? t('app.loading') : t('searchPage.all')}
      />
      {values.isError && <p className="text-sm text-red-700">{t('searchPage.valuesFailed')}</p>}
    </Field>
  );
}

function FixedFilter({ field, state, onChange, fields }: CommonProps & { field: FieldDef }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <Field label={t(field.labelKey)} id={id}>
      <SelectInput
        id={id}
        value={state.values[field.id]?.value ?? ''}
        onChange={(e) => onChange(setFilter(state, fields, field.id, { value: e.target.value }))}
        options={[
          { value: '', label: t('searchPage.all') },
          ...(field.options ?? []).map((o) => ({ value: o.value, label: `${o.icon} ${t(o.labelKey)}` })),
        ]}
      />
    </Field>
  );
}

/** Price / area: "at most" or "at least" a number. The number applies 300 ms after typing stops. */
function RangeFilter({ field, state, onChange, fields }: CommonProps & { field: FieldDef }) {
  const { t } = useTranslation();
  const id = useId();
  const committed = state.values[field.id];
  const operator: SearchOperator = committed?.operator ?? DEFAULT_RANGE_OPERATOR;
  const [draft, setDraft] = useState(committed?.value ?? '');
  const [seen, setSeen] = useState(committed?.value ?? '');
  // Follow resets / back-button changes coming from the URL.
  if ((committed?.value ?? '') !== seen) {
    setSeen(committed?.value ?? '');
    setDraft(committed?.value ?? '');
  }

  useEffect(() => {
    if (draft === (committed?.value ?? '')) return;
    const timer = setTimeout(
      () => onChange(setFilter(state, fields, field.id, { value: draft, operator })),
      TYPE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [draft, committed?.value, state, fields, field.id, operator, onChange]);

  const isPrice = field.id === 'price';
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:col-span-2 lg:col-span-1">
      <Field label={t(field.labelKey)} id={id}>
        <div className="flex flex-col gap-2">
          <SelectInput
            aria-label={t('search.operator')}
            value={operator}
            onChange={(e) =>
              onChange(
                setFilter(state, fields, field.id, {
                  value: committed?.value ?? '',
                  operator: e.target.value as SearchOperator,
                }),
              )
            }
            options={RANGE_OPERATORS.map((o) => ({
              value: o,
              label: `${OPERATOR_SYMBOL[o]}  ${t(`search.operators.${o}`)}`,
            }))}
          />
          <div className="min-w-0">
            <TextInput
              id={id}
              type="number"
              inputMode="decimal"
              min={0}
              dir="ltr"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t(isPrice ? 'searchPage.amount' : 'searchPage.areaValue')}
            />
          </div>
        </div>
      </Field>
      {isPrice && <CurrencyFilter state={state} onChange={onChange} />}
    </div>
  );
}

function CurrencyFilter({ state, onChange }: { state: FilterState; onChange: (n: FilterState) => void }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <Field label={t('search.currency')} id={id}>
      <SelectInput
        id={id}
        value={state.currency}
        onChange={(e) => onChange({ ...state, currency: e.target.value })}
        options={[
          { value: '', label: t('search.allCurrencies') },
          ...CURRENCIES.map((c) => ({ value: c, label: t(`search.currencies.${c}`) })),
        ]}
      />
    </Field>
  );
}

interface PanelProps {
  target: MapTarget;
  state: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
}

/**
 * The filters of one type (legacy filter box). Always open from `md` up; on phones a button folds them away so the
 * results are not pushed below the screen. Every change applies at once — there is no "search" button, like legacy.
 */
export default function FiltersPanel({ target, state, onChange, onReset }: PanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const fields = useMemo(() => filterFields(target), [target]);
  const active = countActive(state);
  const common = { target, state, onChange, fields };

  return (
    <section
      aria-label={t('searchPage.filters')}
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="inline-flex items-center gap-2 text-base font-bold text-slate-800 md:pointer-events-none"
        >
          <ListFilter className="h-5 w-5 text-brand" aria-hidden />
          {t('searchPage.filters')}
          {active > 0 && (
            <span className="rounded-full bg-brand px-2 text-sm font-bold text-white">{active}</span>
          )}
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={active === 0}
          startIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
        >
          {t('searchPage.reset')}
        </Button>
      </div>
      <div
        id={bodyId}
        className={`${open ? 'grid' : 'hidden'} mt-3 items-start gap-3 sm:grid-cols-2 md:grid lg:grid-cols-3 xl:grid-cols-4`}
      >
        {fields.map((f) =>
          f.type === 'dropdown' ? (
            <DropdownFilter key={f.id} field={f} {...common} />
          ) : f.type === 'fixed' ? (
            <FixedFilter key={f.id} field={f} {...common} />
          ) : (
            <RangeFilter key={f.id} field={f} {...common} />
          ),
        )}
      </div>
    </section>
  );
}
