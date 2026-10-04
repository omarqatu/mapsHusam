import {
  BookOpen,
  FileText,
  Headset,
  Info,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserCog,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { telUrl, whatsappUrl } from '@/features/contact/model';
import { usePlatformContact } from '@/features/contact/store';
import type { LegalKey } from '@/features/legal/types';

/** The information pages of the platform (legacy: the top links of the search page), one tap from every page. */
const INFO_ITEMS: { key: LegalKey; icon: LucideIcon }[] = [
  { key: 'about', icon: Info },
  { key: 'guideSubscription', icon: UserPlus },
  { key: 'guideProvider', icon: UserCog },
  { key: 'guide', icon: BookOpen },
  { key: 'terms', icon: FileText },
  { key: 'privacy', icon: ShieldCheck },
  { key: 'contact', icon: Headset },
];

/** The list of links; `onPick` opens the dialog (rendered once by the header). */
export function InfoList({ onPick, className }: { onPick: (k: LegalKey) => void; className?: string }) {
  const { t } = useTranslation();
  const contact = usePlatformContact();
  const wa = whatsappUrl(contact, t('contact.waMessage', { name: t('app.name') }));
  const tel = telUrl(contact);
  const rowClass = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm font-semibold hover:bg-subtle';
  return (
    <ul className={className}>
      {INFO_ITEMS.map(({ key, icon: Icon }) => (
        <li key={key}>
          <button
            type="button"
            onClick={() => onPick(key)}
            className={clsx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm font-semibold hover:bg-subtle')}
          >
            <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            {t(`auth.legal.${key}`)}
          </button>
        </li>
      ))}
      {wa && (
        <li>
          <a href={wa} target="_blank" rel="noopener noreferrer" className={clsx(rowClass)}>
            <MessageCircle className="h-4 w-4 shrink-0 text-whatsapp" aria-hidden />
            {t('contact.menuWhatsapp')}
          </a>
        </li>
      )}
      {tel && (
        <li>
          <a href={tel} className={clsx(rowClass)}>
            <Phone className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            {t('contact.menuCall')}
          </a>
        </li>
      )}
    </ul>
  );
}
