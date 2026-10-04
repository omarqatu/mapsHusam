import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hostOf, playBadge, ytThumb, ytWatch } from './media';
import Modal from './Modal';

export type MediaItem =
  | { type: 'image'; url: string }
  | { type: 'youtube'; id: string }
  | { type: 'video'; url: string }
  | { type: 'link'; url: string; label: string };

/** A picture, YouTube video or video file — what the viewer can show (a plain link cannot be viewed). */
export type VisualItem = Exclude<MediaItem, { type: 'link' }>;
type Visual = VisualItem;

const tile =
  'relative block h-24 w-32 shrink-0 snap-start overflow-hidden rounded-lg border border-black/10 bg-subtle focus-visible:outline-2 focus-visible:outline-brand';
function Tile({ m, onOpen, onBroken }: { m: Visual; onOpen: () => void; onBroken: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onOpen} className={tile} aria-label={m.type === 'image' ? t('media.preview') : t('media.play')}>
      {m.type === 'image' && (
        <img
          src={m.url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={onBroken}
          className="h-full w-full object-cover"
        />
      )}
      {m.type === 'youtube' && (
        <>
          <img src={ytThumb(m.id)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          {playBadge}
        </>
      )}
      {m.type === 'video' && (
        <>
          <video src={`${m.url}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
          {playBadge}
        </>
      )}
    </button>
  );
}

function Viewer({ m }: { m: Visual }) {
  const { t } = useTranslation();
  if (m.type === 'image')
    return <img src={m.url} alt="" referrerPolicy="no-referrer" className="mx-auto max-h-[65vh] rounded-lg" />;
  if (m.type === 'video')
    // eslint-disable-next-line jsx-a11y/media-has-caption -- owner-uploaded clips; there is no caption file to reference
    return <video src={m.url} controls autoPlay playsInline className="mx-auto max-h-[65vh] w-full rounded-lg bg-black" />;
  return (
    <div className="space-y-2">
      {/* YouTube refuses embeds that arrive without a referrer, and the server sends `Referrer-Policy: no-referrer`
          for the page — so this one frame states its own policy. */}
      <iframe
        src={`https://www.youtube.com/embed/${encodeURIComponent(m.id)}?autoplay=1&rel=0`}
        title="YouTube"
        className="aspect-video w-full rounded-lg bg-black"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      />
      {/* Some owners disable embedding: the video must stay reachable. */}
      <a
        href={ytWatch(m.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-fg hover:underline"
      >
        <ExternalLink className="h-4 w-4" aria-hidden /> {t('media.openOnYoutube')}
      </a>
    </div>
  );
}

interface ViewerProps {
  items: VisualItem[];
  /** Index of the open item, or null when closed. */
  index: number | null;
  onIndex: (i: number | null) => void;
}

/** The lightbox: one item at a time with previous / next (arrow keys too, mirrored in RTL). */
export function MediaViewer({ items, index, onIndex }: ViewerProps) {
  const { t } = useTranslation();
  const count = items.length;
  const step = useCallback(
    (d: 1 | -1) => onIndex(index === null ? null : (index + d + count) % count),
    [count, index, onIndex],
  );
  useEffect(() => {
    if (index === null) return;
    const flip = document.dir === 'rtl' ? -1 : 1;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step((1 * flip) as 1 | -1);
      if (e.key === 'ArrowLeft') step((-1 * flip) as 1 | -1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, step]);

  const current = index !== null ? items[index] : undefined;
  return (
    <Modal open={current !== undefined} onClose={() => onIndex(null)} title={t('media.preview')} widthClass="max-w-3xl">
      {current && (
        <div className="space-y-3">
          <Viewer key={current.type === 'youtube' ? current.id : current.url} m={current} />
          {count > 1 && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={t('media.prev')}
                className="rounded-lg border border-line-strong p-2 hover:bg-subtle"
              >
                <ChevronRight className="h-5 w-5 rtl:rotate-0 ltr:rotate-180" aria-hidden />
              </button>
              <span className="text-sm text-muted">
                {(index ?? 0) + 1} / {count}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={t('media.next')}
                className="rounded-lg border border-line-strong p-2 hover:bg-subtle"
              >
                <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden />
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * A strip of thumbnails (pictures, YouTube, video files) that opens in a viewer with previous / next, plus plain links.
 * Nothing heavy loads until it is tapped: YouTube is a thumbnail, not an iframe. A picture URL that is not a picture
 * (e.g. a Facebook page) becomes a link. URLs must already be validated as https (featureModel.safeMediaUrl).
 * Pattern from the water platform's AttachmentGallery.
 */
export default function MediaGallery({ items }: { items: MediaItem[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());

  const visual = items.filter(
    (i): i is Visual => i.type !== 'link' && !(i.type === 'image' && broken.has(i.url)),
  );
  const links = items.filter((i): i is Extract<MediaItem, { type: 'link' }> => i.type === 'link');
  const brokenUrl = items.find((i) => i.type === 'image' && broken.has(i.url));

  if (!items.length) return null;
  // Links are secondary to pictures: small chips, the site's name in the tooltip.
  const linkClass =
    'inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-subtle px-3 text-sm font-semibold text-brand-fg hover:border-brand';

  return (
    <div className="space-y-2">
      {visual.length > 0 && (
        <div className="flex snap-x gap-2 overflow-x-auto pb-1">
          {visual.map((m, i) => (
            <Tile
              key={m.type === 'youtube' ? m.id : m.url}
              m={m}
              onOpen={() => setOpen(i)}
              onBroken={() => m.type === 'image' && setBroken((b) => new Set(b).add(m.url))}
            />
          ))}
        </div>
      )}
      {(links.length > 0 || brokenUrl) && (
        <div className="flex flex-wrap gap-1.5">
          {brokenUrl && brokenUrl.type === 'image' && (
            <a href={brokenUrl.url} target="_blank" rel="noopener noreferrer" title={hostOf(brokenUrl.url)} className={linkClass}>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('media.openImages')}
            </a>
          )}
          {links.map((m) => (
            <a key={m.url} href={m.url} target="_blank" rel="noopener noreferrer" title={hostOf(m.url)} className={linkClass}>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {m.label}
            </a>
          ))}
        </div>
      )}
      <MediaViewer items={visual} index={open} onIndex={setOpen} />
    </div>
  );
}
