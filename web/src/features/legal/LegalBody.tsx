import RichText from '@/components/RichText';
import LegalDocView from './LegalDocView';
import type { LegalOverride } from './overrides';
import type { LegalDoc } from './types';

/** The text itself: the admin's replacement when there is one, otherwise the built-in document. */
export default function LegalBody({ doc, custom }: { doc: LegalDoc; custom: LegalOverride | null }) {
  return custom ? <RichText html={custom.html} /> : <LegalDocView doc={doc} />;
}
