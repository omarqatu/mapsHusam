import clsx from 'clsx';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hasDirectContact, whatsappDigits, type PlatformContact } from './model';
import { usePlatformContact } from './queries';

const tones = {
  /** On the dark footer. */
  footer: 'bg-footer-line text-white hover:bg-brand',
  /** On a surface (the "contact us" page). */
  surface: 'border border-line bg-surface text-fg hover:bg-subtle',
} as const;

function links(c: PlatformContact, greeting: string) {
  const wa = whatsappDigits(c.whatsapp);
  return [
    c.whatsapp && wa
      ? {
          key: 'whatsapp',
          href: `https://api.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(greeting)}`,
          icon: <MessageCircle className="h-4 w-4 text-whatsapp" aria-hidden />,
          value: c.whatsapp,
          external: true,
        }
      : null,
    c.phone
      ? {
          key: 'phone',
          href: `tel:${c.phone}`,
          icon: <Phone className="h-4 w-4" aria-hidden />,
          value: c.phone,
          external: false,
        }
      : null,
    c.email
      ? {
          key: 'email',
          href: `mailto:${c.email}`,
          icon: <Mail className="h-4 w-4" aria-hidden />,
          value: c.email,
          external: false,
        }
      : null,
  ].filter((l) => l !== null);
}

/** WhatsApp / call / email the platform, as buttons that show the number itself. Nothing when none is set. */
export default function ContactLinks({
  tone = 'surface',
  className,
}: {
  tone?: keyof typeof tones;
  className?: string;
}) {
  const { t } = useTranslation();
  const contact = usePlatformContact();
  if (!hasDirectContact(contact)) return null;
  return (
    <ul className={clsx('flex flex-wrap gap-2', className)} aria-label={t('platformContact.title')}>
      {links(contact, t('platformContact.greeting')).map((l) => (
        <li key={l.key}>
          <a
            href={l.href}
            {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={clsx(
              'inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold',
              tones[tone],
            )}
          >
            {l.icon}
            <span className="sr-only">{t(`platformContact.${l.key}`)}: </span>
            <bdi dir="ltr">{l.value}</bdi>
          </a>
        </li>
      ))}
    </ul>
  );
}
