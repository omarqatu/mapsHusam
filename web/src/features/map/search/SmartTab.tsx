import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { searchApi, type SearchCondition, type SearchOperator } from '@/api/search';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import SelectInput from '@/components/ui/SelectInput';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import { cascadeFilters, fieldsFor, OPERATOR_SYMBOL, operatorsFor, withCurrency } from './model';
import { hasPrice, targetToApi, type MapTarget } from '../targets';
import { useSearchUi } from './store';
import TargetSelect from './TargetSelect';
import { useSearchActions } from './useSearchActions';

const CURRENCIES = ['USD', 'ILS', 'JOD'];
const CUSTOM = '__custom__';

interface Chip extends SearchCondition {
  /** What the person sees (label of a fixed option, etc.); `value` is what is sent. */
  shown: string;
  fieldLabel: string;
}

/** Smart search: pick a type, build conditions (field / operator / value), run over the whole layer. */
export default function SmartTab() {
  const { t } = useTranslation();
  const actions = useSearchActions();
  const busy = useSearchUi((s) => s.busy);
  const [target, setTarget] = useState<MapTarget | null>(null);
  const [fieldId, setFieldId] = useState('');
  const [operator, setOperator] = useState<SearchOperator>('=');
  const [value, setValue] = useState('');
  const [custom, setCustom] = useState(false);
  const [currency, setCurrency] = useState('');
  const [chips, setChips] = useState<Chip[]>([]);

  const fields = useMemo(() => (target ? fieldsFor(target) : []), [target]);
  const field = fields.find((f) => f.id === fieldId) ?? fields[0];
  const conditions = chips.map(({ field: f, operator: o, value: v }) => ({
    field: f,
    operator: o,
    value: v,
  }));
  const cascade = field ? cascadeFilters(field.id, conditions) : {};

  const unique = useQuery({
    queryKey: ['unique-values', target && targetToApi(target), field?.id, cascade.gov_a, cascade.village_a],
    queryFn: () => searchApi.uniqueValues({ ...targetToApi(target!), field: field!.id, ...cascade }),
    enabled: !!target && field?.type === 'dropdown',
    staleTime: 5 * 60_000,
    select: (d) => (d.values ?? []).map(String).sort((a, b) => a.localeCompare(b, 'ar')),
  });

  const pickTarget = (x: MapTarget | null) => {
    setTarget(x);
    setChips([]);
    setFieldId('');
    setValue('');
    setCustom(false);
    setOperator('=');
  };
  const pickField = (id: string) => {
    setFieldId(id);
    setValue('');
    setCustom(false);
    const def = fields.find((f) => f.id === id);
    setOperator(def ? operatorsFor(def.type)[0] : '=');
  };

  const pendingChips = (): Chip[] => {
    const v = value.trim();
    if (!field || !v) return [];
    const fixed = field.options?.find((o) => o.value === v);
    const shown = fixed ? `${fixed.icon} ${t(fixed.labelKey)}` : v;
    const base: Chip = { field: field.id, operator, value: v, shown, fieldLabel: t(field.labelKey) };
    return withCurrency(field.id, base, currency).map((c) =>
      c.field === 'currency'
        ? { ...c, shown: t(`search.currencies.${c.value}`), fieldLabel: t('search.currency') }
        : { ...base, ...c },
    );
  };

  const add = () => {
    const next = pendingChips();
    if (!next.length) return;
    setChips((c) => [...c, ...next]);
    setValue('');
  };

  const run = () => {
    if (!target) return toast.warning(t('search.chooseTypeFirst'));
    const all = [...chips, ...pendingChips()];
    if (!all.length) return toast.warning(t('search.addCriteria'));
    void actions.smart(
      target,
      all.map(({ field: f, operator: o, value: v }) => ({ field: f, operator: o, value: v })),
    );
  };

  const clear = () => {
    setChips([]);
    setValue('');
    actions.clear();
  };

  return (
    <div className="space-y-3">
      <FormField label={t('search.type')} name="smart-type">
        <TargetSelect id="smart-type" value={target} onChange={pickTarget} />
      </FormField>

      {target && field && (
        <>
          <FormField label={t('search.field')} name="smart-field">
            <SelectInput
              id="smart-field"
              value={field.id}
              onChange={(e) => pickField(e.target.value)}
              options={fields.map((f) => ({ value: f.id, label: t(f.labelKey) }))}
            />
          </FormField>
          <FormField label={t('search.operator')} name="smart-operator">
            <SelectInput
              id="smart-operator"
              value={operator}
              onChange={(e) => setOperator(e.target.value as SearchOperator)}
              options={operatorsFor(field.type).map((o) => ({
                value: o,
                label: `${OPERATOR_SYMBOL[o]}  ${t(`search.operators.${o}`)}`,
              }))}
              disabled={field.type === 'fixed'}
            />
          </FormField>
          <FormField label={t('search.value')} name="smart-value">
            {field.type === 'fixed' ? (
              <SelectInput
                id="smart-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t('search.chooseValue')}
                options={(field.options ?? []).map((o) => ({
                  value: o.value,
                  label: `${o.icon} ${t(o.labelKey)}`,
                }))}
              />
            ) : field.type === 'number' ? (
              <TextInput
                id="smart-value"
                type="number"
                inputMode="decimal"
                dir="ltr"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            ) : custom ? (
              <div className="flex gap-2">
                <TextInput
                  id="smart-value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={t('search.typeValue')}
                  autoComplete="off"
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCustom(false);
                    setValue('');
                  }}
                  title={t('search.backToList')}
                >
                  📋
                </Button>
              </div>
            ) : (
              <SelectInput
                id="smart-value"
                value={value}
                onChange={(e) =>
                  e.target.value === CUSTOM ? (setCustom(true), setValue('')) : setValue(e.target.value)
                }
                searchable
                placeholder={unique.isLoading ? t('app.loading') : t('search.chooseValue')}
                options={[
                  { value: CUSTOM, label: t('search.customValue') },
                  ...(unique.data ?? []).map((v) => ({ value: v, label: v })),
                ]}
              />
            )}
          </FormField>
          {field.id === 'price' && hasPrice(target) && (
            <FormField label={t('search.currency')} name="smart-currency">
              <SelectInput
                id="smart-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                options={[
                  { value: '', label: t('search.allCurrencies') },
                  ...CURRENCIES.map((c) => ({ value: c, label: t(`search.currencies.${c}`) })),
                ]}
              />
            </FormField>
          )}
          <Button
            variant="secondary"
            className="w-full"
            startIcon={<Plus className="h-4 w-4" />}
            onClick={add}
            disabled={!value.trim()}
          >
            {t('search.addCondition')}
          </Button>
        </>
      )}

      {chips.length > 0 && (
        <ul className="space-y-1.5" aria-label={t('search.conditions')}>
          {chips.map((c, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg border border-line bg-subtle px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1">
                <b>{c.fieldLabel}</b> {OPERATOR_SYMBOL[c.operator]} <span dir="auto">{c.shown}</span>
              </span>
              <button
                type="button"
                aria-label={t('common.delete')}
                onClick={() => setChips((cs) => cs.filter((_, j) => j !== i))}
                className="rounded p-1 text-danger hover:bg-danger-soft"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={run} loading={busy}>
          {t('search.run')}
        </Button>
        <Button variant="secondary" onClick={clear}>
          {t('search.clear')}
        </Button>
      </div>
    </div>
  );
}
