import { useId, useMemo, useState } from 'react';
import { ArrowLeftRight, Image, Star, ThumbsUp, Trophy, Video, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import {
  FEATURED_RATING,
  RECOMMENDED_RATING,
  hasBeforeAfter,
  hasPhotos,
  hasVideos,
  pickForSection,
  type FeaturedEntry,
  type FeaturedMode,
} from '../map/extras/featured';
import { useRatedFeatures, useTopRatedFeatures } from '../map/extras/queries';
import type { Props as FeatureProps } from '../map/popup/featureModel';
import { featuredOrder, seededRandom } from './featuredOrder';
import ListingCard from './ListingCard';
import ScrollRow from './ScrollRow';

interface RowProps {
  title: string;
  icon: LucideIcon;
  badge: string;
  mode: FeaturedMode;
  /** null while loading. */
  entries: FeaturedEntry[] | null;
  /** Paid placements: the featured frame on every card. */
  highlight?: boolean;
}

/** A heading and one scrolling row of cards; nothing at all when the section is empty. */
function Row({ title, icon: Icon, badge, mode, entries, highlight }: RowProps) {
  const id = useId();
  const shown = useMemo(() => (entries ? pickForSection(entries) : null), [entries]);
  if (shown && shown.length === 0) return null;
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className="flex items-center gap-2 text-xl font-black text-fg">
        <Icon className="h-5 w-5 text-brand-fg" aria-hidden /> {title}
      </h2>
      <ScrollRow label={title}>
        {shown
          ? shown.map((e) => (
              <ListingCard
                key={e.r.key}
                entry={e}
                mode={mode}
                badge={badge}
                highlight={highlight}
                className="w-64 shrink-0 snap-start"
              />
            ))
          : [0, 1, 2].map((i) => <div key={i} className="h-72 w-64 shrink-0 animate-pulse rounded-xl bg-subtle-2" aria-hidden />)}
      </ScrollRow>
    </section>
  );
}

/**
 * The rows under the categories (legacy featured-services portal): featured, top rated, recommended, then the listings
 * with photos, with videos and with before / after pictures. Same data as the map's Extras panel, shown as rows of cards.
 */
export default function LandingSections() {
  const { t } = useTranslation();
  // One order per visit: equal advertisers take turns at the front of the featured row.
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 32));
  const featured = useRatedFeatures(FEATURED_RATING);
  const recommended = useRatedFeatures(RECOMMENDED_RATING);
  const topRated = useTopRatedFeatures();

  const featuredEntries = useMemo(
    () => (featured.data ? featuredOrder([featured.data], seededRandom(seed), featured.data.length).map((r) => ({ r })) : null),
    [featured.data, seed],
  );
  const recommendedEntries = useMemo(() => recommended.data?.map((r) => ({ r })) ?? null, [recommended.data]);
  // The media rows draw from both rating tiers (legacy).
  const pool = useMemo(
    () => (featuredEntries || recommendedEntries ? [...(featuredEntries ?? []), ...(recommendedEntries ?? [])] : null),
    [featuredEntries, recommendedEntries],
  );
  const withMedia = (has: (p: FeatureProps) => boolean) =>
    featured.isPending && recommended.isPending ? null : (pool ?? []).filter((e) => has(e.r.props));

  if (featured.isError && recommended.isError && topRated.isError)
    return <AlertMessage type="error" message={t('extras.featured.failed')} />;

  const rows: RowProps[] = [
    { title: t('extras.featured.sections.featured'), icon: Star, badge: t('extras.featured.badge.featured'), mode: 'all', entries: featuredEntries, highlight: true },
    { title: t('extras.featured.sections.topRated'), icon: Trophy, badge: t('extras.featured.badge.topRated'), mode: 'all', entries: topRated.data ?? null },
    { title: t('extras.featured.sections.recommended'), icon: ThumbsUp, badge: t('extras.featured.badge.recommended'), mode: 'all', entries: recommendedEntries },
    { title: t('extras.featured.sections.photos'), icon: Image, badge: t('extras.featured.badge.photos'), mode: 'photo', entries: withMedia(hasPhotos) },
    { title: t('extras.featured.sections.videos'), icon: Video, badge: t('extras.featured.badge.videos'), mode: 'video', entries: withMedia(hasVideos) },
    { title: t('extras.featured.sections.beforeAfter'), icon: ArrowLeftRight, badge: t('extras.featured.badge.beforeAfter'), mode: 'beforeAfter', entries: withMedia(hasBeforeAfter) },
  ];
  return (
    <>
      {rows.map((row) => (
        <Row key={row.title} {...row} />
      ))}
    </>
  );
}
