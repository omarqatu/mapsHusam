import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import LegalBody from './LegalBody';
import { useLegalDoc } from './useLegalDoc';
import type { LegalKey } from './types';

/** One legal text written out in place (the register step): its own title and the text, the admin's version if there is one. */
function InlineText({ docKey }: { docKey: LegalKey }) {
  const { t } = useTranslation();
  const { doc, custom, isLoading } = useLegalDoc(docKey);
  return (
    <section aria-labelledby={`inline-legal-${docKey}`} className="space-y-2">
      <h3 id={`inline-legal-${docKey}`} className="text-sm font-black text-brand-fg">
        {custom?.title || doc?.title || t(`auth.legal.${docKey}`)}
      </h3>
      {doc ? (
        <LegalBody doc={doc} custom={custom} />
      ) : isLoading ? (
        <Spinner />
      ) : (
        <p className="text-sm text-muted">{t('auth.legal.loadFailed')}</p>
      )}
    </section>
  );
}

/**
 * The full privacy policy and terms, one after the other in a box that scrolls (legacy `auth-terms-container`): a person
 * agrees to what they can read on the spot, not to a link. Focusable, so a keyboard can scroll it.
 */
export default function InlineLegal({ keys = ['privacy', 'terms'] }: { keys?: LegalKey[] }) {
  const { t } = useTranslation();
  return (
    <div
      role="region"
      aria-label={t('auth.legal.inlineLabel')}
      // a box that scrolls must take focus, or a keyboard cannot read to the end of the terms
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className="max-h-72 space-y-5 overflow-y-auto rounded-xl border border-line bg-surface/80 p-3 text-sm focus-visible:outline-2 focus-visible:outline-brand"
    >
      {keys.map((k) => (
        <InlineText key={k} docKey={k} />
      ))}
    </div>
  );
}
