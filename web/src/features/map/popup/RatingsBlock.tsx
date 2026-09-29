import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useServiceRatings } from '@/api/mapEvents';
import StarRating from '@/components/ui/StarRating';
import { formatDate } from '@/lib/format';

/** Average stars + expandable comments. Comment text is rendered as text only (legacy injected it as HTML). */
export default function RatingsBlock({ layer, featureId }: { layer: string; featureId: string }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useServiceRatings(layer, featureId);

  if (isError) return null; // ratings are a bonus; a failure must not clutter the card
  return (
    <div className="text-sm">
      {isLoading ? (
        <p className="text-muted">{t('popup.rating.loading')}</p>
      ) : !data || data.totalRatings === 0 ? (
        <p className="text-muted">{t('popup.rating.none')}</p>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <StarRating value={data.averageRating} />
            <b className="text-fg">{data.averageRating}</b>
            <span className="text-muted">{t('popup.rating.count', { count: data.totalRatings })}</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-fg hover:underline"
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            {open
              ? t('popup.rating.hideComments')
              : t('popup.rating.showComments', { count: data.totalRatings })}
          </button>
          {open && (
            <ul className="mt-2 max-h-52 space-y-1.5 overflow-y-auto rounded-lg bg-subtle p-1.5">
              {data.ratings.map((r, i) => (
                <li key={i} className="rounded bg-surface p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-fg">
                      {r.user_name || t('popup.rating.user')}
                    </span>
                    <StarRating value={r.rating} />
                  </div>
                  {r.comment && <p className="mt-1 text-sm leading-relaxed text-muted">{r.comment}</p>}
                  <p className="mt-1 text-sm text-muted">{formatDate(r.created_at, i18n.language)}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
