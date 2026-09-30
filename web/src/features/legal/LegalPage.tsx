import { useParams } from 'react-router';
import { CenteredSpinner } from '@/components/ui/Spinner';
import NotFoundPage from '@/routes/NotFoundPage';
import LegalBody from './LegalBody';
import { legalTitleIcons } from './legalIcons';
import { isLegalKey } from './content';
import { useLegalDoc } from './useLegalDoc';

/** `/legal/:key` — the same texts as the dialog, as a shareable page (terms, privacy, guides, about, contact). */
export default function LegalPage() {
  const { key } = useParams();
  const legalKey = isLegalKey(key) ? key : null;
  const { doc, custom, isLoading } = useLegalDoc(legalKey);
  if (!legalKey) return <NotFoundPage />;
  if (isLoading) return <CenteredSpinner />;
  if (!doc) return <NotFoundPage />;
  const Icon = legalTitleIcons[doc.icon];
  return (
    <article className="mx-auto w-full max-w-2xl rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h1 className="mb-4 flex items-center gap-2 border-b-2 border-brand pb-3 text-xl font-black text-brand-fg">
        <Icon className="h-6 w-6 shrink-0" aria-hidden />
        {custom?.title || doc.title}
      </h1>
      <LegalBody doc={doc} custom={custom} />
    </article>
  );
}
