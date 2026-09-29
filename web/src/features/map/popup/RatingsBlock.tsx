import { useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useServiceRatings } from '@/api/mapEvents';

const Stars = ({ value }: { value: number }) => (
  <span className="inline-flex text-amber-400" aria-label={`${value}/5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} className="h-4 w-4" fill={n <= Math.round(value) ? 'currentColor' : 'none'} aria-hidden />
    ))}
  </span>
);

/** Average stars + expandable comments. Comment text is rendered as text only (legacy injected it as HTML). */
export default function RatingsBlock({ layer, featureId }: { layer: string; featureId: string }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useServiceRatings(layer, featureId);

  if (isError) return null; // ratings are a bonus; a failure must not clutter the card
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      {isLoading ? (
        <p className="text-xs text-slate-500">{t('popup.rating.loading')}</p>
      ) : !data || data.totalRatings === 0 ? (
        <p className="text-xs text-slate-500">{t('popup.rating.none')}</p>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm">
            <Stars value={data.averageRating} />
            <b className="text-slate-800">{data.averageRating}</b>
            <span className="text-slate-500">{t('popup.rating.count', { count: data.totalRatings })}</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-2 inline-flex items-center gap-1.5 rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-hover"
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            {open
              ? t('popup.rating.hideComments')
              : t('popup.rating.showComments', { count: data.totalRatings })}
          </button>
          {open && (
            <ul className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">
              {data.ratings.map((r, i) => (
                <li key={i} className="rounded bg-white p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      {r.user_name || t('popup.rating.user')}
                    </span>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="mt-1 text-xs leading-relaxed text-slate-600">{r.comment}</p>}
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(r.created_at).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-GB')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
