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
    <footer className="mt-8 space-y-3 border-t border-line py-6 text-center text-fg">
      <LegalLinks keys={KEYS} linkClassName="text-brand-fg" />
      <a
        href={FACEBOOK_PAGE}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-fg hover:underline"
      >
        <ExternalLink className="h-4 w-4" aria-hidden /> {t('searchPage.contactUs')}
      </a>
      <p className="text-sm text-muted">{t('searchPage.about')}</p>
      <p className="text-sm text-muted">
        © 2026 {t('app.name')}
      </p>
    </footer>
  );
}
