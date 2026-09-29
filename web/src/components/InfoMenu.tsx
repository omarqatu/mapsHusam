import { BookOpen, FileText, Headset, Info, ShieldCheck, UserCog, UserPlus, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
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
  return (
    <ul className={className}>
      {INFO_ITEMS.map(({ key, icon: Icon }) => (
        <li key={key}>
          <button
            type="button"
            onClick={() => onPick(key)}
            className={clsx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm font-semibold hover:bg-slate-100')}
          >
            <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            {t(`auth.legal.${key}`)}
          </button>
        </li>
      ))}
    </ul>
  );
}
