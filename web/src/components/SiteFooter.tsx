import { ChevronLeft, MapPinned } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LegalLinks from '@/features/legal/LegalLinks';
import type { LegalKey } from '@/features/legal/types';
import ContactLinks from '@/features/platform-contact/ContactLinks';
import SocialIcon from '@/features/platform-contact/SocialIcon';
import { SOCIAL_KEYS } from '@/features/platform-contact/model';
import { usePlatformContact } from '@/features/platform-contact/queries';

const GUIDE_KEYS: LegalKey[] = ['guide', 'guideSearch', 'guideProvider', 'guideSubscription'];
const COMPANY_KEYS: LegalKey[] = ['guideMapInteractive', 'about', 'terms', 'privacy'];

const socialClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-full bg-footer-line text-white hover:bg-brand';
const linkClass = 'py-0.5 leading-5 text-footer-muted hover:text-white';
const arrow = <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-brand-fg ltr:rotate-180" aria-hidden />;

function Column({ title, keys }: { title: string; keys: LegalKey[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="mb-1.5 inline-block border-b-2 border-brand pb-1 text-sm font-black text-white">{title}</h2>
      <LegalLinks keys={keys} layout="column" className="gap-0.5" leading={arrow} linkClassName={linkClass} />
    </nav>
  );
}

/**
 * The public page footer (the legacy dark footer, made compact): brand + one line about the platform + the social
 * links, two link columns, the copyright underneath. Used by every regular page and by the welcome / login / register
 * shell; the links open the legal dialogs.
 */
export default function SiteFooter({ className }: { className?: string }) {
  const { t } = useTranslation();
  // The admin's addresses (/admin/contact); a network without one is not shown (legacy drew dead "#" buttons).
  const contact = usePlatformContact();
  const social = SOCIAL_KEYS.map((k) => [k, contact.social[k]] as const).filter(([, url]) => !!url);
  return (
    <footer className={`border-t-4 border-brand bg-footer text-footer-fg ${className ?? ''}`}>
      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 md:grid-cols-[1.4fr_1fr_1fr] md:gap-x-10">
        <div className="col-span-2 space-y-2 md:col-span-1">
          <p className="flex items-center gap-2 text-lg font-black text-white">
            <MapPinned className="h-5 w-5 text-brand-fg" aria-hidden />
            {t('app.name')}
          </p>
          <p className="text-xs leading-relaxed text-footer-muted">{t('searchPage.about')}</p>
          <ContactLinks tone="footer" />
          {social.length > 0 && (
            <ul className="flex gap-2">
              {social.map(([key, url]) => (
                <li key={key}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t(`footer.social.${key}`)}
                    title={t(`footer.social.${key}`)}
                    className={socialClass}
                  >
                    <SocialIcon name={key} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Column title={t('footer.guides')} keys={GUIDE_KEYS} />
        <Column title={t('footer.company')} keys={COMPANY_KEYS} />
      </div>
      <p className="border-t border-footer-line px-4 py-2 text-center text-xs text-footer-muted">
        {/* The year is isolated left-to-right so the © never jumps to the far side of an Arabic name. */}
        <bdi dir="ltr">© {new Date().getFullYear()}</bdi> {t('app.name')}
      </p>
    </footer>
  );
}
