import type { ReactNode } from 'react';
import { ChevronLeft, MapPinned, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LegalLinks from '@/features/legal/LegalLinks';
import type { LegalKey } from '@/features/legal/types';

const GUIDE_KEYS: LegalKey[] = ['guide', 'guideSearch', 'guideProvider', 'guideSubscription'];
const COMPANY_KEYS: LegalKey[] = ['guideMapInteractive', 'about', 'terms', 'privacy'];

const socialClass = 'inline-flex h-8 w-8 items-center justify-center rounded-full bg-footer-line text-white';
const linkClass = 'py-0.5 leading-5 text-footer-muted hover:text-white';
const arrow = <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-brand-fg ltr:rotate-180" aria-hidden />;

/** lucide-react has no brand icons, so the three that are not WhatsApp are plain paths (currentColor, 24 × 24). */
const glyph = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
    {children}
  </svg>
);

/**
 * The platform's pages on social networks, in the order they show. An entry with an empty `url` is drawn as a plain,
 * unclickable icon (the legacy footer had WhatsApp / YouTube / LinkedIn buttons that pointed at "#"); paste the real
 * address here and it becomes a link.
 */
const SOCIAL: { key: 'facebook' | 'whatsapp' | 'youtube' | 'linkedin'; url: string; icon: ReactNode }[] = [
  {
    key: 'facebook',
    url: 'https://www.facebook.com/MapServesPalestine',
    icon: glyph(
      <path d="M13.5 22v-8.2h2.8l.5-3.3h-3.3V8.4c0-.9.4-1.7 1.8-1.7h1.6V3.9c-.3 0-1.3-.2-2.4-.2-2.5 0-4.1 1.5-4.1 4.2v2.6H7.6v3.3h2.8V22h3.1z" />,
    ),
  },
  { key: 'whatsapp', url: '', icon: <MessageCircle className="h-4 w-4" aria-hidden /> },
  {
    key: 'youtube',
    url: '',
    icon: glyph(
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z" />,
    ),
  },
  {
    key: 'linkedin',
    url: '',
    icon: glyph(
      <path d="M4.5 9h3.6v12H4.5zM6.3 3.2a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM10.2 9h3.4v1.6c.5-.9 1.7-1.9 3.5-1.9 3.6 0 4.3 2.4 4.3 5.4V21h-3.6v-6c0-1.4 0-3.2-2-3.2s-2.2 1.5-2.2 3.1V21h-3.6z" />,
    ),
  },
];

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
  return (
    <footer className={`border-t-4 border-brand bg-footer text-footer-fg ${className ?? ''}`}>
      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 md:grid-cols-[1.4fr_1fr_1fr] md:gap-x-10">
        <div className="col-span-2 space-y-2 md:col-span-1">
          <p className="flex items-center gap-2 text-lg font-black text-white">
            <MapPinned className="h-5 w-5 text-brand-fg" aria-hidden />
            {t('app.name')}
          </p>
          <p className="text-xs leading-relaxed text-footer-muted">{t('searchPage.about')}</p>
          <ul className="flex gap-2">
            {SOCIAL.map((l) => (
              <li key={l.key}>
                {l.url ? (
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t(`footer.social.${l.key}`)}
                    title={t(`footer.social.${l.key}`)}
                    className={socialClass + ' hover:bg-brand'}
                  >
                    {l.icon}
                  </a>
                ) : (
                  <span aria-hidden className={socialClass + ' opacity-60'}>
                    {l.icon}
                  </span>
                )}
              </li>
            ))}
          </ul>
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
