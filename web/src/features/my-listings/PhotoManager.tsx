import { useRef, useState } from 'react';
import { ImageOff, ImagePlus, Star, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MAX_PHOTOS, useSetPhotos, useUploadPhoto, type MyListing } from '@/api/myListings';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/toastStore';
import { safeMediaUrl } from '@/features/map/popup/featureModel';
import { errorText } from '@/lib/errorText';
import { ImageError, shrinkImage } from '@/lib/shrinkImage';

/**
 * A listing's pictures: add several at once (shrunk in the browser first), remove one, make one the cover (the first).
 * Every change is saved at once — no "save" for pictures.
 */
export default function PhotoManager({ listing }: { listing: MyListing }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadPhoto();
  const setPhotos = useSetPhotos();
  const [uploading, setUploading] = useState(0);
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const photos = listing.photos;
  const room = MAX_PHOTOS - photos.length;

  async function add(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (input.current) input.current.value = '';
    if (!list.length) return;
    if (list.length > room) toast.warning(t('myListings.photos.full', { max: MAX_PHOTOS }));
    const chosen = list.slice(0, Math.max(0, room));
    setUploading(chosen.length);
    // one after the other: the server checks the limit against what is already saved
    for (const file of chosen) {
      try {
        const blob = await shrinkImage(file);
        await upload.mutateAsync({ listing, file: blob });
      } catch (e) {
        toast.error(
          e instanceof ImageError
            ? t('myListings.photos.notImage')
            : errorText(e, t('myListings.photos.failed')),
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const save = (next: string[]) =>
    setPhotos.mutate(
      { listing, photos: next },
      { onError: (e) => toast.error(errorText(e, t('myListings.photos.removeFailed'))) },
    );

  return (
    <div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((url, i) => {
          const src = safeMediaUrl(url);
          const bad = !src || broken.has(url);
          return (
            <li
              key={url}
              className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-subtle"
            >
              {bad ? (
                <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted">
                  <ImageOff className="h-5 w-5" aria-hidden />
                  {t('myListings.photos.broken')}
                </span>
              ) : (
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={() => setBroken((b) => new Set(b).add(url))}
                />
              )}
              {i === 0 && (
                <span className="absolute start-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
                  {t('myListings.photos.cover')}
                </span>
              )}
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                {i > 0 ? (
                  <button
                    type="button"
                    title={t('myListings.photos.makeCover')}
                    aria-label={t('myListings.photos.makeCover')}
                    disabled={setPhotos.isPending}
                    className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    onClick={() => save([url, ...photos.filter((p) => p !== url)])}
                  >
                    <Star className="h-4 w-4" aria-hidden />
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  title={t('myListings.photos.remove')}
                  aria-label={t('myListings.photos.remove')}
                  disabled={setPhotos.isPending}
                  className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-danger-solid"
                  onClick={() => save(photos.filter((p) => p !== url))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
        {Array.from({ length: uploading }, (_, i) => (
          <li
            key={`up-${i}`}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-xs text-muted"
          >
            <Spinner />
            {t('myListings.photos.uploading')}
          </li>
        ))}
        {room - uploading > 0 && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand/40 bg-brand-light/40 text-sm font-bold text-brand-fg hover:bg-brand-light"
            >
              <ImagePlus className="h-6 w-6" aria-hidden />
              {t('myListings.photos.add')}
            </button>
          </li>
        )}
      </ul>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void add(e.target.files)}
      />
      <p className="mt-2 flex justify-between gap-2 text-xs text-muted">
        <span>{t('myListings.photos.hint')}</span>
        <span className="shrink-0 tabular-nums">
          {t('myListings.photos.count', { count: photos.length, max: MAX_PHOTOS })}
        </span>
      </p>
    </div>
  );
}
