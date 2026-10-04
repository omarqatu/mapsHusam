import { useState } from 'react';
import { MessageCircle, Phone, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import SectionCard from '@/components/ui/SectionCard';
import { CenteredSpinner } from '@/components/ui/Spinner';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import { errorText } from '@/lib/errorText';
import { isValidNumber, sameContact, NO_CONTACT, type PlatformContact } from './model';
import { useContactQuery, useSaveContact } from './store';

/** The form, started from the saved numbers. The card remounts it (`key`) when the saved value changes. */
function ContactForm({ saved }: { saved: PlatformContact }) {
  const { t } = useTranslation();
  const save = useSaveContact();
  const [whatsapp, setWhatsapp] = useState(saved.whatsapp);
  const [phone, setPhone] = useState(saved.phone);

  const whatsappBad = !isValidNumber(whatsapp);
  const phoneBad = !isValidNumber(phone);
  const dirty = !sameContact({ whatsapp, phone }, saved);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (whatsappBad || phoneBad) return;
    save.mutate(
      { whatsapp, phone },
      {
        onSuccess: () => toast.success(t('contact.saved')),
        onError: (err) => toast.error(errorText(err, t('contact.saveFailed'))),
      },
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-x-4 sm:grid-cols-2" noValidate>
      <FormField
        label={t('contact.whatsapp')}
        name="contact-whatsapp"
        error={whatsappBad ? t('contact.invalid') : undefined}
      >
        <TextInput
          id="contact-whatsapp"
          dir="ltr"
          inputMode="tel"
          autoComplete="off"
          placeholder="0599123456"
          value={whatsapp}
          hasError={whatsappBad}
          startIcon={<MessageCircle className="h-4 w-4" aria-hidden />}
          onChange={(e) => setWhatsapp(e.target.value)}
        />
      </FormField>
      <FormField label={t('contact.phone')} name="contact-phone" error={phoneBad ? t('contact.invalid') : undefined}>
        <TextInput
          id="contact-phone"
          dir="ltr"
          inputMode="tel"
          autoComplete="off"
          placeholder="022345678"
          value={phone}
          hasError={phoneBad}
          startIcon={<Phone className="h-4 w-4" aria-hidden />}
          onChange={(e) => setPhone(e.target.value)}
        />
      </FormField>
      <p className="text-xs text-muted sm:col-span-2">{t('contact.hint')}</p>
      <div className="pt-3 sm:col-span-2">
        <Button
          type="submit"
          startIcon={<Save className="h-4 w-4" aria-hidden />}
          loading={save.isPending}
          disabled={!dirty || whatsappBad || phoneBad}
        >
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

/** Admin: the platform's own WhatsApp and phone (shown in the footer and the information menu of every page). */
export default function ContactSettingsCard() {
  const { t } = useTranslation();
  const query = useContactQuery();
  const saved = query.data?.contact ?? NO_CONTACT;

  return (
    <SectionCard
      id="contact"
      title={t('contact.title')}
      subtitle={t('contact.subtitle')}
      icon={<MessageCircle className="h-5 w-5" aria-hidden />}
      className="mb-4"
    >
      {query.isPending ? <CenteredSpinner /> : <ContactForm key={`${saved.whatsapp}|${saved.phone}`} saved={saved} />}
    </SectionCard>
  );
}
