import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Modal from '@/components/ui/Modal';
import SelectInput from '@/components/ui/SelectInput';
import TextInput from '@/components/ui/TextInput';
import { formatGrid } from '../mapUtils';
import { ALWAYS_OPEN, validateValues, type FormErrors, type FormValues } from './attributes';
import { useTargetLabel } from './useTargetLabel';
import type { EditTarget, FieldDef } from './schema';

interface Props {
  target: EditTarget;
  mode: 'insert' | 'update';
  initial: FormValues;
  /** Grid position of a point (shown so the admin sees what "move" changes). */
  position?: [number, number];
  /** Save now (with the shape as it is). */
  onSave: (values: FormValues) => void;
  /** Keep the values and go edit the shape / position on the map first. */
  onEditShape: (values: FormValues) => void;
  onCancel: () => void;
  /** A save is being prepared (region look-up) — the buttons wait. */
  busy?: boolean;
}

type Variant = 'realEstate' | 'service' | 'road';
const variantOf = (t: EditTarget): Variant =>
  t.workspace === 'services' ? 'service' : t.id === 'roads' ? 'road' : 'realEstate';

function useFieldLabel(target: EditTarget) {
  const { t } = useTranslation();
  const variant = variantOf(target);
  return (field: FieldDef) =>
    field.name === 'name' || field.name === 'des'
      ? t(`edit.fields.${field.name}.${variant}`)
      : field.name === 'price' && variant === 'service'
        ? t('edit.fields.priceService') // no currency box for services: the label says the price is in dollars
        : t(`edit.fields.${field.name}`, { max: field.max });
}

/** The attribute form of every editable layer (legacy attribute modals), fields from `schema.ts`. Text via JSX only. */
export default function AttributeDialog({
  target,
  mode,
  initial,
  position,
  onSave,
  onEditShape,
  onCancel,
  busy,
}: Props) {
  const { t } = useTranslation();
  const label = useFieldLabel(target);
  const targetLabel = useTargetLabel()(target);
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));

  const submit = (next: (v: FormValues) => void) => {
    const found = validateValues(target, values);
    setErrors(found);
    if (Object.keys(found).length === 0) next(values);
  };

  const shapeKey = target.kind === 'point' ? 'edit.dialog.movePoint' : 'edit.dialog.editShape';

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onCancel}
      title={t(mode === 'insert' ? 'edit.dialog.addTitle' : 'edit.dialog.editTitle', { name: targetLabel })}
      widthClass="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant="secondary" onClick={() => submit(onEditShape)} disabled={busy}>
            {t(shapeKey)}
          </Button>
          <Button onClick={() => submit(onSave)} loading={busy}>
            {t('edit.dialog.save')}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(onSave);
        }}
        noValidate
      >
        {position && (
          <p className="mb-3 rounded-lg bg-subtle px-3 py-2 text-sm text-fg">
            {t('edit.dialog.position')}{' '}
            <bdi dir="ltr" className="font-semibold">
              {formatGrid(position)}
            </bdi>
          </p>
        )}
        <div className="grid gap-x-4 sm:grid-cols-2">
          {target.fields.map((field) => {
            const id = `edit-${field.name}`;
            const error = errors[field.name];
            const wide = field.type === 'hours' || field.name === 'des' || field.type === 'url';
            return (
              <FormField
                key={field.name}
                name={id}
                label={label(field)}
                error={error ? t(`edit.errors.${error}`, { max: field.max }) : undefined}
                className={wide ? 'sm:col-span-2' : undefined}
              >
                {field.type === 'select' ? (
                  <SelectInput
                    id={id}
                    aria-label={label(field)}
                    value={values[field.name]}
                    hasError={!!error}
                    options={(field.options ?? []).map((o) => ({
                      value: o,
                      label: t(`edit.options.${field.name}.${o}`),
                    }))}
                    onChange={(e) => set(field.name, e.target.value)}
                  />
                ) : field.type === 'hours' ? (
                  <div className="flex gap-2">
                    <TextInput
                      id={id}
                      value={values[field.name]}
                      placeholder={t('edit.dialog.hoursExample')}
                      onChange={(e) => set(field.name, e.target.value)}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => set(field.name, ALWAYS_OPEN)}
                      className="shrink-0"
                    >
                      {t('edit.dialog.hours24')}
                    </Button>
                  </div>
                ) : (
                  <TextInput
                    id={id}
                    value={values[field.name]}
                    hasError={!!error}
                    type={
                      field.type === 'number' || field.type === 'integer'
                        ? 'number'
                        : field.type === 'date'
                          ? 'date'
                          : 'text'
                    }
                    step={field.type === 'integer' ? 1 : field.type === 'number' ? 'any' : undefined}
                    inputMode={field.type === 'number' || field.type === 'integer' ? 'decimal' : undefined}
                    dir={field.ltr ? 'ltr' : undefined}
                    onChange={(e) => set(field.name, e.target.value)}
                  />
                )}
              </FormField>
            );
          })}
        </div>
        {/* Enter in a field submits the form. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
