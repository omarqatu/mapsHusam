import { useId, useState } from 'react';
import { ArrowLeftRight, Images } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MediaGallery from '@/components/ui/MediaGallery';
import Tabs from '@/components/ui/Tabs';
import {
  beforeAfterPair,
  collectMedia,
  labelMedia,
  mediaDefault,
  sideMedia,
  type MediaView,
  type Props,
} from './featureModel';

/** The provider's before / after pictures side by side, each labelled. */
export function BeforeAfterPair({ before, after }: { before: string; after: string }) {
  const { t } = useTranslation();
  const side = (label: string, url: string, linkLabelKey: string) => (
    <figure className="min-w-0 space-y-1">
      <figcaption className="text-center text-sm font-bold text-muted">{label}</figcaption>
      <MediaGallery items={labelMedia(sideMedia(url, linkLabelKey), t)} fill />
    </figure>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {side(t('media.before'), before, 'popup.moreDetails1')}
      {side(t('media.after'), after, 'popup.moreDetails2')}
    </div>
  );
}

/**
 * A listing's media: its pictures / video / links, and — when the provider added them — the before / after pair. With
 * both, a switch between the two, opening on the provider's choice (`media_default`). Nothing when there is no media.
 */
export default function MediaShowcase({ props }: { props: Props }) {
  const { t } = useTranslation();
  const id = useId();
  const media = labelMedia(collectMedia(props), t);
  const pair = beforeAfterPair(props);
  const [view, setView] = useState<MediaView>(() => mediaDefault(props));

  if (!pair) return media.length > 0 ? <MediaGallery items={media} /> : null;
  if (media.length === 0) return <BeforeAfterPair {...pair} />;
  return (
    <div className="space-y-2">
      <Tabs<MediaView>
        tabs={[
          { id: 'photos', label: t('media.photos'), icon: <Images className="h-4 w-4" aria-hidden /> },
          { id: 'beforeAfter', label: t('media.beforeAfter'), icon: <ArrowLeftRight className="h-4 w-4" aria-hidden /> },
        ]}
        value={view}
        onChange={setView}
        label={t('media.views')}
        idPrefix={id}
        scrollable
      />
      <div role="tabpanel" id={`${id}-tabpanel-${view}`} aria-labelledby={`${id}-tab-${view}`}>
        {view === 'photos' ? <MediaGallery items={media} /> : <BeforeAfterPair {...pair} />}
      </div>
    </div>
  );
}
