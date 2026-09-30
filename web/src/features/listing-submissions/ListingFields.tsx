import { useTranslation } from 'react-i18next';
import Checkbox from '@/components/ui/Checkbox';
import FormField from '@/components/ui/FormField';
import SelectInput from '@/components/ui/SelectInput';
import TextInput from '@/components/ui/TextInput';
import TextareaInput from '@/components/ui/TextareaInput';
import LocationPicker from './LocationPicker';
import { DES_MAX, HOURS_MAX, NAME_MAX, hasPriceField } from './model';
import type { ListingForm } from './useListingForm';

/** Type, name, description, hours, price (hotels and villas). `idPrefix` keeps ids unique when two forms share a page. */
export function AboutFields({ form, idPrefix = '' }: { form: ListingForm; idPrefix?: string }) {
  const { t } = useTranslation();
  const { values, errors, set, message } = form;
  return (
    <div className="grid gap-x-4 sm:grid-cols-2">
      <FormField
        label={t('submit.fields.layer')}
        name={`${idPrefix}layer`}
        required
        error={message('layer')}
        className="sm:col-span-2"
      >
        <SelectInput
          id={`${idPrefix}layer`}
          searchable
          options={form.options}
          value={values.layer}
          placeholder={t('submit.fields.layerPlaceholder')}
          hasError={!!errors.layer}
          onChange={(e) => set('layer', e.target.value)}
        />
      </FormField>
      <FormField
        label={t('submit.fields.name')}
        name={`${idPrefix}name`}
        required
        error={message('name')}
        className="sm:col-span-2"
      >
        <TextInput
          id={`${idPrefix}name`}
          value={values.name}
          maxLength={NAME_MAX}
          hasError={!!errors.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </FormField>
      <FormField label={t('submit.fields.des')} name={`${idPrefix}des`} className="sm:col-span-2">
        <TextareaInput
          id={`${idPrefix}des`}
          rows={3}
          value={values.des}
          maxLength={DES_MAX}
          onChange={(e) => set('des', e.target.value)}
        />
      </FormField>
      <FormField label={t('submit.fields.workHours')} name={`${idPrefix}workHours`}>
        <TextInput
          id={`${idPrefix}workHours`}
          value={values.workHours}
          maxLength={HOURS_MAX}
          placeholder={t('submit.fields.workHoursHint')}
          onChange={(e) => set('workHours', e.target.value)}
        />
      </FormField>
      {hasPriceField(values.layer) && (
        <FormField label={t('submit.fields.price')} name={`${idPrefix}price`} error={message('price')}>
          <TextInput
            id={`${idPrefix}price`}
            inputMode="decimal"
            dir="ltr"
            value={values.price}
            hasError={!!errors.price}
            onChange={(e) => set('price', e.target.value)}
          />
        </FormField>
      )}
    </div>
  );
}

/** The business phone and the WhatsApp choice. `optional` (register): empty = use the account's number. */
export function ContactFields({
  form,
  idPrefix = '',
  optional,
}: {
  form: ListingForm;
  idPrefix?: string;
  optional?: boolean;
}) {
  const { t } = useTranslation();
  const { values, errors, set, message } = form;
  return (
    <>
      <FormField
        label={t('submit.fields.phone')}
        name={`${idPrefix}phone`}
        required={!optional}
        error={message('phone')}
      >
        <TextInput
          id={`${idPrefix}phone`}
          type="tel"
          inputMode="tel"
          dir="ltr"
          placeholder={optional ? t('submit.fields.phoneSameAsAccount') : '05XXXXXXXX'}
          value={values.phone}
          hasError={!!errors.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
      </FormField>
      <Checkbox
        checked={values.whatsappSame}
        onChange={(checked) => set('whatsappSame', checked)}
        label={t('submit.fields.whatsappSame')}
      />
    </>
  );
}

export function LocationField({ form }: { form: ListingForm }) {
  return (
    <>
      <LocationPicker value={form.point} onChange={form.setPoint} invalid={!!form.errors.point} />
      {form.errors.point && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {form.message('point')}
        </p>
      )}
    </>
  );
}
