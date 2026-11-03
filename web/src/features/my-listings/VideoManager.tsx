import { useRef, useState } from 'react';
import { Film, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  MAX_VIDEOS,
  useRemoveListingVideo,
  useUploadListingVideo,
  type MyListing,
} from '@/api/myListings';
import Button from '@/components/ui/Button';
import MediaGallery from '@/components/ui/MediaGallery';
import { toast } from '@/components/ui/toastStore';
import { collectMedia, labelMedia } from '@/features/map/popup/featureModel';
import { errorText } from '@/lib/errorText';
import { Spinner } from '@/components/ui/Spinner';

type VideoIssue = 'tooLarge' | 'tooLong' | 'unsupported';

function inspectVideo(file: File): Promise<VideoIssue | null> {
  if (file.size > MAX_VIDEO_BYTES) return Promise.resolve('tooLarge');
  // An iPhone records MOV (video/quicktime): the same container as MP4, which the server accepts.
  const supported = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type) || /\.(mp4|webm|mov)$/i.test(file.name);
  if (!supported) return Promise.resolve('unsupported');
  const src = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      // An unknown duration is left to the server, which reads it from the file itself.
      const issue: VideoIssue | null = Number.isFinite(video.duration) && video.duration > MAX_VIDEO_SECONDS ? 'tooLong' : null;
      URL.revokeObjectURL(src);
      video.removeAttribute('src');
      video.load();
      resolve(issue);
    };
    // This browser cannot decode the clip (H.265 from a phone, on a computer without that decoder). That says nothing
    // about the file: the server checks its bytes and duration, and phones play it.
    video.onerror = () => {
      URL.revokeObjectURL(src);
      resolve(null);
    };
    video.src = src;
  });
}

/** Up to three MP4/WebM clips per listing; the server checks file bytes and embedded duration again. */
export default function VideoManager({ listing }: { listing: MyListing }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadListingVideo();
  const remove = useRemoveListingVideo();
  const [busy, setBusy] = useState(false);
  const videos = listing.videos ?? (listing.video ? [listing.video] : []);

  async function add(file: File | undefined) {
    if (input.current) input.current.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const issue = await inspectVideo(file);
      if (issue) {
        toast.warning(t(`myListings.video.${issue}`, { size: Math.round(MAX_VIDEO_BYTES / 1024 / 1024), seconds: MAX_VIDEO_SECONDS }));
        return;
      }
      if (videos.length >= MAX_VIDEOS) {
        toast.warning(t('myListings.video.full', { max: MAX_VIDEOS }));
        return;
      }
      await upload.mutateAsync({ listing, file });
      toast.success(t('myListings.video.uploaded'));
    } catch (e) {
      toast.error(errorText(e, t('myListings.video.failed')));
    } finally {
      setBusy(false);
    }
  }

  function onRemove(url: string) {
    remove.mutate({ listing, url }, {
      onSuccess: () => toast.success(t('myListings.video.removed')),
      onError: (e) => toast.error(errorText(e, t('myListings.video.removeFailed'))),
    });
  }

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-fg">
          <Film className="h-4 w-4" aria-hidden /> {t('myListings.video.title')}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={busy || videos.length >= MAX_VIDEOS} onClick={() => input.current?.click()}>
            {busy ? <Spinner /> : <Upload className="h-4 w-4" aria-hidden />}
            <span className="ms-1">{t('myListings.video.add')}</span>
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted">{t('myListings.video.hint', { max: MAX_VIDEOS, size: Math.round(MAX_VIDEO_BYTES / 1024 / 1024), seconds: MAX_VIDEO_SECONDS })}</p>
      {videos.map((url) => {
        const items = labelMedia(collectMedia({ video: url }), t);
        return (
          <div className="flex items-start gap-2" key={url}>
            <div className="min-w-0 flex-1"><MediaGallery items={items} /></div>
            <Button variant="secondary" size="sm" disabled={busy || remove.isPending} onClick={() => onRemove(url)}>
              <Trash2 className="h-4 w-4" aria-hidden /> <span className="ms-1">{t('myListings.video.remove')}</span>
            </Button>
          </div>
        );
      })}
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        className="hidden"
        onChange={(e) => void add(e.target.files?.[0])}
      />
    </div>
  );
}
