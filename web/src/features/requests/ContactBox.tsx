import { MessageCircle, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { telLink, whatsappLink } from '@/features/map/popup/featureModel';
import type { ContactInfo } from './model';

interface Props {
  contact: ContactInfo;
  otherName: string | null;
  serviceType: string | null;
}

/** Shown once both sides agreed: call / WhatsApp with the legacy greeting. */
export default function ContactBox({ contact, otherName, serviceType }: Props) {
  const { t } = useTranslation();
  const tel = contact.phone ? telLink(contact.phone) : null;
  const wa = contact.whatsappDigits
    ? whatsappLink(
        contact.whatsappDigits,
        t('requests.contact.waMessage', {
          name: otherName?.trim() || t('requests.contact.otherFallback'),
          service: serviceType?.trim() || t('requests.contact.serviceFallback'),
        }),
      )
    : null;

  if (!tel && !wa)
    return (
      <p className="text-sm text-slate-600">
        <b>{t('requests.contact.agreed')}</b> {t('requests.contact.none')}
      </p>
    );

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
      <p className="mb-2 text-sm font-bold text-green-800">{t('requests.contact.title')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {tel && (
          <a
            href={tel}
            className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {t('requests.contact.call', { phone: contact.phone })}
          </a>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-whatsapp px-3 py-1.5 text-xs font-bold text-white hover:bg-whatsapp-hover"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            {t('requests.contact.whatsapp', { number: contact.whatsapp })}
          </a>
        )}
      </div>
    </div>
  );
}
