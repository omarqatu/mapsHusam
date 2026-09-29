import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';

export type MediaItem =
  | { type: 'image'; url: string }
  | { type: 'youtube'; id: string }
  | { type: 'video'; url: string }
  | { type: 'link'; url: string; label: string };

/** A thumbnail that turns into a plain link when the URL is not really an image (e.g. a Facebook page). */
function Thumb({ url, onOpen }: { url: string; onOpen: () => void }) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="col-span-3 flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 p-2 text-sm font-semibold text-brand hover:underline"
      >
        <ExternalLink className="h-4 w-4" aria-hidden /> {t('media.openImages')}
      </a>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="block cursor-zoom-in">
      <img
        src={url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="h-24 w-full rounded-lg border border-black/10 object-cover"
      />
    </button>
  );
}

/**
 * Images (3-column thumbnails, click to enlarge), embedded YouTube / video files, and plain links.
 * URLs must already be validated as https (see featureModel.safeMediaUrl) — this component trusts them.
 * Pattern from the water platform's AttachmentGallery.
 */
export default function MediaGallery({ items }: { items: MediaItem[] }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  if (!items.length) return null;
  const images = items.filter((i): i is Extract<MediaItem, { type: 'image' }> => i.type === 'image');
  const others = items.filter((i) => i.type !== 'image');

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {images.map((img) => (
            <Thumb key={img.url} url={img.url} onOpen={() => setPreview(img.url)} />
          ))}
        </div>
      )}
      {others.map((m) =>
        m.type === 'youtube' ? (
          <iframe
            key={m.id}
            src={`https://www.youtube.com/embed/${encodeURIComponent(m.id)}`}
            title="YouTube"
            className="aspect-video w-full rounded-lg"
            allow="encrypted-media"
            allowFullScreen
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        ) : m.type === 'video' ? (
          <video key={m.url} src={m.url} controls preload="metadata" className="w-full rounded-lg" />
        ) : (
          <a
            key={m.url}
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-semibold text-brand underline"
          >
            <ExternalLink className="h-4 w-4" aria-hidden /> {m.label}
          </a>
        ),
      )}
      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={t('media.preview')}
        widthClass="max-w-3xl"
      >
        {preview && (
          <img
            src={preview}
            alt=""
            referrerPolicy="no-referrer"
            className="mx-auto max-h-[70vh] rounded-lg"
          />
        )}
      </Modal>
    </div>
  );
}
