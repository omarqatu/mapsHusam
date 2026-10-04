import { useState } from 'react';
import { MapPin, MessageCircle, Phone, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEditListing, type Currency, type MyListing } from '@/api/myListings';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Modal from '@/components/ui/Modal';
import SelectInput from '@/components/ui/SelectInput';
import TextInput from '@/components/ui/TextInput';
import TextareaInput from '@/components/ui/TextareaInput';
import { toast } from '@/components/ui/toastStore';
import type { Coordinate } from '@/features/map/config';
import HourPresets from '@/features/listing-submissions/HourPresets';
import LocationPicker from '@/features/listing-submissions/LocationPicker';
import { errorText } from '@/lib/errorText';
import {
  CURRENCIES,
  listingFields,
  toEdit,
  toFormValues,
  validateListing,
  type ListingFormErrors,
  type ListingFormValues,
} from './model';
import PhotoManager from './PhotoManager';

/**
 * One listing's sheet: pictures (saved as they change), then the details and — for a service — its point, saved
 * together. Only what changed is sent; it shows on the map at once.
 */
export default function ListingEditor({ listing, onClose }: { listing: MyListing; onClose: () => void }) {
  const { t } = useTranslation();
  const edit = useEditListing();
  const fields = listingFields(listing);
  const [v, setV] = useState<ListingFormValues>(() => toFormValues(listing));
  const [point, setPoint] = useState<Coordinate | null>(
    listing.x !== null && listing.y !== null ? [listing.x, listing.y] : null,
  );
  const [errors, setErrors] = useState<ListingFormErrors>({});
  const set = <K extends keyof ListingFormValues>(k: K, value: ListingFormValues[K]) => {
    setV((old) => ({ ...old, [k]: value }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const msg = (k: keyof ListingFormErrors) =>
    errors[k] ? t(`myListings.editor.errors.${k}.${errors[k]}`) : undefined;

  const moved =
    fields.move && point && listing.x !== null && listing.y !== null
      ? Math.hypot(point[0] - listing.x, point[1] - listing.y) > 0.5
      : false;

  function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    const found = validateListing(v, listing);
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = toEdit(v, listing);
    if (moved && point)
      Object.assign(body, { x_coord: Number(point[0].toFixed(3)), y_coord: Number(point[1].toFixed(3)) });
    if (Object.keys(body).length === 0) return onClose();
    edit.mutate(
      { listing, body },
      {
        onSuccess: () => {
          toast.success(t('myListings.editor.saved'));
          onClose();
        },
        onError: (err) => toast.error(errorText(err, t('myListings.editor.failed'))),
      },
    );
  }

  const section = 'space-y-3 border-t border-line pt-5 first:border-t-0 first:pt-0';
  const heading = 'text-base font-bold text-fg';

  return (
    <Modal
      open
      onClose={onClose}
      sheetOnPhone
      widthClass="max-w-2xl"
      title={t('myListings.editor.title', { name: listing.name })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="listing-editor"
            loading={edit.isPending}
            startIcon={<Save className="h-4 w-4" aria-hidden />}
          >
            {t('myListings.editor.save')}
          </Button>
        </>
      }
    >
      <form id="listing-editor" onSubmit={onSubmit} noValidate className="space-y-5">
        <section className={section}>
          <h3 className={heading}>{t('myListings.editor.photos')}</h3>
          <PhotoManager listing={listing} />
        </section>

        <section className={section}>
          <h3 className={heading}>{t('myListings.editor.details')}</h3>
          <FormField label={t('myListings.editor.name')} name="le-name" required error={msg('name')}>
            <TextInput
              id="le-name"
              value={v.name}
              maxLength={100}
              hasError={!!errors.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </FormField>
          <FormField label={t('myListings.editor.des')} name="le-des">
            <TextareaInput
              id="le-des"
              rows={3}
              maxLength={1000}
              value={v.des}
              onChange={(e) => set('des', e.target.value)}
            />
          </FormField>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <FormField label={t('myListings.editor.phone')} name="le-phone" required error={msg('phone')}>
              <div dir="ltr">
                <TextInput
                  id="le-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="05XXXXXXXX"
                  startIcon={<Phone className="h-4 w-4" aria-hidden />}
                  value={v.phone}
                  hasError={!!errors.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </div>
            </FormField>
            <FormField label={t('myListings.editor.whatsapp')} name="le-whatsapp" error={msg('whatsapp')}>
              <div dir="ltr">
                <TextInput
                  id="le-whatsapp"
                  type="tel"
                  inputMode="tel"
                  placeholder="05XXXXXXXX"
                  startIcon={<MessageCircle className="h-4 w-4" aria-hidden />}
                  value={v.whatsapp}
                  hasError={!!errors.whatsapp}
                  onChange={(e) => set('whatsapp', e.target.value)}
                />
              </div>
            </FormField>
          </div>
          {fields.hours && (
            <FormField label={t('myListings.editor.workHours')} name="le-hours">
              <HourPresets value={v.workHours} onChange={(h) => set('workHours', h)} />
              <div dir="ltr">
                <TextInput
                  id="le-hours"
                  maxLength={200}
                  placeholder={t('myListings.editor.workHoursHint')}
                  value={v.workHours}
                  onChange={(e) => set('workHours', e.target.value)}
                />
              </div>
            </FormField>
          )}
          {fields.price && (
            <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
              <FormField label={t('myListings.editor.price')} name="le-price" error={msg('price')}>
                <TextInput
                  id="le-price"
                  inputMode="decimal"
                  dir="ltr"
                  value={v.price}
                  hasError={!!errors.price}
                  onChange={(e) => set('price', e.target.value)}
                />
              </FormField>
              <FormField label={t('myListings.editor.currency')} name="le-currency">
                <SelectInput
                  id="le-currency"
                  options={CURRENCIES.map((c) => ({ value: c, label: t(`edit.options.currency.${c}`) }))}
                  value={v.currency}
                  onChange={(e) => set('currency', e.target.value as Currency)}
                />
              </FormField>
              {fields.area && (
                <FormField label={t('myListings.editor.area')} name="le-area" error={msg('area')}>
                  <TextInput
                    id="le-area"
                    inputMode="numeric"
                    dir="ltr"
                    value={v.area}
                    hasError={!!errors.area}
                    onChange={(e) => set('area', e.target.value)}
                  />
                </FormField>
              )}
            </div>
          )}
        </section>

        <section className={section}>
          <h3 className={`${heading} flex items-center gap-1.5`}>
            <MapPin className="h-4 w-4" aria-hidden />
            {t('myListings.editor.location')}
          </h3>
          {fields.move ? (
            <LocationPicker value={point} onChange={setPoint} />
          ) : (
            <AlertMessage type="info" message={t('myListings.editor.propertyLocation')} />
          )}
        </section>
      </form>
    </Modal>
  );
}
