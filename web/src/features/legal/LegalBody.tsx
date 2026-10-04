import RichText from '@/components/RichText';
import ContactLinks from '@/features/platform-contact/ContactLinks';
import LegalDocView from './LegalDocView';
import type { LegalOverride } from './overrides';
import type { LegalDoc, LegalKey } from './types';

/**
 * The text itself: the admin's replacement when there is one, otherwise the built-in document. The "contact us" text
 * starts with the platform's WhatsApp / phone / email buttons (/admin/contact), whatever the text says.
 */
export default function LegalBody({ doc, custom, docKey }: { doc: LegalDoc; custom: LegalOverride | null; docKey?: LegalKey }) {
  return (
    <>
      {docKey === 'contact' && <ContactLinks className="mb-4" />}
      {custom ? <RichText html={custom.html} /> : <LegalDocView doc={doc} />}
    </>
  );
}
