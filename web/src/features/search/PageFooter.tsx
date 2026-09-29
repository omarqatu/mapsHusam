import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LegalLinks from '../legal/LegalLinks';
import type { LegalKey } from '../legal/types';

const FACEBOOK_PAGE = 'https://www.facebook.com/MapServesPalestine';
const KEYS: LegalKey[] = [
  'guide',
  'guideSearch',
  'guideProvider',
  'guideSubscription',
  'guideMapInteractive',
  'about',
  'terms',
  'privacy',
];

/** Legacy page footer, reduced to what people used: the guides, about / terms / privacy, and the contact page. */
export default function PageFooter() {
  const { t } = useTranslation();
  return (
    <footer className="mt-8 space-y-3 border-t border-slate-200 py-6 text-center text-slate-700">
      <LegalLinks keys={KEYS} linkClassName="text-brand" />
      <a
        href={FACEBOOK_PAGE}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
      >
        <ExternalLink className="h-4 w-4" aria-hidden /> {t('searchPage.contactUs')}
      </a>
      <p className="text-sm text-slate-600">{t('searchPage.about')}</p>
      <p className="text-sm text-slate-600">
        © 2026 {t('app.name')}
      </p>
    </footer>
  );
}
