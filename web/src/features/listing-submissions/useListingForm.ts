import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubmittableLayers } from '@/api/listingSubmissions';
import type { SelectOption } from '@/components/ui/SelectInput';
import type { Coordinate } from '@/features/map/config';
import { SERVICE_BY_KEY, groupLabelKey, serviceLabelKey } from '@/features/map/registry';
import { EMPTY_FORM, validate, type FormErrors, type FormValues } from './model';

/** The state of the business form, shared by the "add my business" page and the register form. */
/** `enabled: false` (register form, box unticked) keeps the type list from being fetched for nothing. */
export function useListingForm(enabled = true) {
  const { t } = useTranslation();
  const layers = useSubmittableLayers(enabled);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [point, setPointState] = useState<Coordinate | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const options = useMemo<SelectOption[]>(
    () =>
      (layers.data ?? [])
        .map((key) => SERVICE_BY_KEY.get(key))
        .filter((s) => s !== undefined)
        .map((s) => ({
          value: s.key,
          label: `${s.icon} ${t(serviceLabelKey(s.key))}`,
          group: t(groupLabelKey(s.group)),
        })),
    [layers.data, t],
  );

  return {
    layers,
    options,
    values,
    point,
    errors,
    set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
      setValues((v) => ({ ...v, [key]: value }));
      setErrors((e) => ({ ...e, [key]: undefined }));
    },
    setPoint(p: Coordinate) {
      setPointState(p);
      setErrors((e) => ({ ...e, point: undefined }));
    },
    /** Checks the form (the values may be completed first, e.g. a phone taken from the account); true = valid. */
    check(effective: FormValues = values): boolean {
      const found = validate(effective, point);
      setErrors(found);
      return Object.keys(found).length === 0 && point !== null;
    },
    message: (key: keyof FormErrors) => (errors[key] ? t(`submit.errors.${key}.${errors[key]}`) : undefined),
  };
}
export type ListingForm = ReturnType<typeof useListingForm>;
