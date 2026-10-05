import { useRef, useState } from 'react';
import clsx from 'clsx';
import { ImageOff, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useBeforeAfterSide,
  useEditListing,
  type BeforeAfterSide,
  type MediaDefault,
  type MyListing,
} from '@/api/myListings';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/toastStore';
import { safeMediaUrl } from '@/features/map/popup/featureModel';
import { errorText } from '@/lib/errorText';
import { ImageError, shrinkImage } from '@/lib/shrinkImage';

const SIDES: BeforeAfterSide[] = ['before', 'after'];

/** One side: its picture (or an empty slot), replace and remove. */
function Slot({ listing, side }: { listing: MyListing; side: BeforeAfterSide }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const change = useBeforeAfterSide();
  const [broken, setBroken] = useState<string | null>(null);
  const url = listing[side];
  const src = url ? safeMediaUrl(url) : null;
  const label = t(`media.${side}`);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (input.current) input.current.value = '';
    if (!file) return;
    try {
      const blob = await shrinkImage(file);
      await change.mutateAsync({ listing, side, file: blob });
    } catch (e) {
      toast.error(e instanceof ImageError ? t('myListings.photos.notImage') : errorText(e, t('myListings.photos.failed')));
    }
  }

  const remove = () =>
    change.mutate(
      { listing, side, file: null },
      { onError: (e) => toast.error(errorText(e, t('myListings.photos.removeFailed'))) },
    );

  const roundButton = 'grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80';
  return (
    <figure className="min-w-0 space-y-1.5">
      <figcaption className="text-center text-sm font-bold text-fg">{label}</figcaption>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-subtle">
        {change.isPending ? (
          <span className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted">
            <Spinner />
            {t('myListings.photos.uploading')}
          </span>
        ) : url ? (
          <>
            {!src || broken === url ? (
              <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted">
                <ImageOff className="h-5 w-5" aria-hidden />
                {t('myListings.photos.broken')}
              </span>
            ) : (
              <img src={src} alt={label} className="h-full w-full object-cover" onError={() => setBroken(url)} />
            )}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
              <button
                type="button"
                className={roundButton}
                title={t('myListings.beforeAfter.replace', { side: label })}
                aria-label={t('myListings.beforeAfter.replace', { side: label })}
                onClick={() => input.current?.click()}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                className={clsx(roundButton, 'hover:bg-danger-solid')}
                title={t('myListings.beforeAfter.remove', { side: label })}
                aria-label={t('myListings.beforeAfter.remove', { side: label })}
                onClick={remove}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 border-2 border-dashed border-brand/40 bg-brand-light/40 text-sm font-bold text-brand-fg hover:bg-brand-light"
          >
            <ImagePlus className="h-6 w-6" aria-hidden />
            {t('myListings.beforeAfter.add', { side: label })}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={t('myListings.beforeAfter.add', { side: label })}
        onChange={(e) => void upload(e.target.files)}
      />
    </figure>
  );
}

/**
 * A service's before / after pictures (optional) and what its card shows first: the pictures above, or the pair.
 * Every change is saved at once, like the pictures.
 */
export default function BeforeAfterManager({ listing }: { listing: MyListing }) {
  const { t } = useTranslation();
  const edit = useEditListing();
  const complete = !!listing.before && !!listing.after;
  // The choice shows at once while it is being saved (and goes back if saving fails); without both pictures the card
  // cannot open on them.
  const [saving, setSaving] = useState<MediaDefault | null>(null);
  const chosen: MediaDefault = complete ? (saving ?? listing.media_default) : 'photos';

  const choose = (value: MediaDefault) => {
    if (value === chosen) return;
    setSaving(value);
    edit.mutate(
      { listing, body: { media_default: value } },
      {
        onError: (e) => toast.error(errorText(e, t('myListings.editor.failed'))),
        onSettled: () => setSaving(null),
      },
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t('myListings.beforeAfter.hint')}</p>
      <div className="grid grid-cols-2 gap-3">
        {SIDES.map((side) => (
          <Slot key={side} listing={listing} side={side} />
        ))}
      </div>
      <fieldset disabled={!complete} className="space-y-1.5 disabled:opacity-60">
        <legend className="text-sm font-bold text-fg">{t('myListings.beforeAfter.showFirst')}</legend>
        <div className="flex flex-wrap gap-2">
          {(['photos', 'before_after'] as const).map((value) => (
            <label
              key={value}
              className={clsx(
                'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold',
                chosen === value ? 'border-brand bg-brand-light text-brand-fg' : 'border-line text-fg',
              )}
            >
              <input
                type="radio"
                name={`media-default-${listing.layer}-${listing.id}`}
                value={value}
                checked={chosen === value}
                onChange={() => choose(value)}
                className="accent-brand"
              />
              {t(value === 'photos' ? 'media.photos' : 'media.beforeAfter')}
            </label>
          ))}
        </div>
        {!complete && <p className="text-xs text-muted">{t('myListings.beforeAfter.needBoth')}</p>}
      </fieldset>
    </div>
  );
}
