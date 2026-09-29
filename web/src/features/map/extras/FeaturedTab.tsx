import { useMemo, type ReactNode } from 'react';
import { Image, LocateFixed, Star, ThumbsUp, Trophy, Video, ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type Props } from '../popup/featureModel';
import AlertMessage from '@/components/ui/AlertMessage';
import SectionCard from '@/components/ui/SectionCard';
import { CenteredSpinner } from '@/components/ui/Spinner';
import FeaturedCard from './FeaturedCard';
import {
  FEATURED_RATING,
  RECOMMENDED_RATING,
  hasBeforeAfter,
  hasPhotos,
  hasVideos,
  pickForSection,
  type FeaturedEntry,
  type FeaturedMode,
} from './featured';
import NearMeSection from './NearMeSection';
import { useRatedFeatures, useTopRatedFeatures } from './queries';

const icon = 'h-4 w-4';

interface SectionProps {
  title: string;
  icon: ReactNode;
  badge: string;
  mode: FeaturedMode;
  /** null while loading. */
  entries: FeaturedEntry[] | null;
  failed: boolean;
}

function Section({ title, icon: sectionIcon, badge, mode, entries, failed }: SectionProps) {
  const { t } = useTranslation();
  const shown = useMemo(() => (entries ? pickForSection(entries) : []), [entries]);
  return (
    <SectionCard title={title} icon={sectionIcon}>
      {failed ? (
        <AlertMessage type="error" message={t('extras.featured.failed')} />
      ) : entries === null ? (
        <CenteredSpinner minHeight="5rem" size="sm" />
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-500">{t('extras.featured.empty')}</p>
      ) : (
        <div className="space-y-2">
          {shown.map((entry) => (
            <FeaturedCard key={entry.r.key} entry={entry} mode={mode} badge={badge} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/** Featured-services portal (legacy "خدمات مميزة"): near me, featured, top rated, recommended, and media sections. */
export default function FeaturedTab() {
  const { t } = useTranslation();
  const featured = useRatedFeatures(FEATURED_RATING);
  const recommended = useRatedFeatures(RECOMMENDED_RATING);
  const topRated = useTopRatedFeatures();

  const featuredEntries = useMemo(() => featured.data?.map((r) => ({ r })) ?? null, [featured.data]);
  const recommendedEntries = useMemo(() => recommended.data?.map((r) => ({ r })) ?? null, [recommended.data]);
  // The media sections draw from both rating tiers (legacy).
  const pool = useMemo(
    () => (featuredEntries || recommendedEntries ? [...(featuredEntries ?? []), ...(recommendedEntries ?? [])] : null),
    [featuredEntries, recommendedEntries],
  );
  const mediaEntries = (has: (p: Props) => boolean) =>
    featured.isPending && recommended.isPending ? null : (pool ?? []).filter((e) => has(e.r.props));
  const poolFailed = featured.isError && recommended.isError;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{t('extras.featured.intro')}</p>
      <SectionCard title={t('extras.featured.nearMe')} icon={<LocateFixed className={icon} aria-hidden />}>
        <NearMeSection />
      </SectionCard>
      <Section
        title={t('extras.featured.sections.featured')}
        icon={<Star className={icon} aria-hidden />}
        badge={t('extras.featured.badge.featured')}
        mode="all"
        entries={featuredEntries}
        failed={featured.isError}
      />
      <Section
        title={t('extras.featured.sections.topRated')}
        icon={<Trophy className={icon} aria-hidden />}
        badge={t('extras.featured.badge.topRated')}
        mode="all"
        entries={topRated.data ?? null}
        failed={topRated.isError}
      />
      <Section
        title={t('extras.featured.sections.recommended')}
        icon={<ThumbsUp className={icon} aria-hidden />}
        badge={t('extras.featured.badge.recommended')}
        mode="all"
        entries={recommendedEntries}
        failed={recommended.isError}
      />
      <Section
        title={t('extras.featured.sections.photos')}
        icon={<Image className={icon} aria-hidden />}
        badge={t('extras.featured.badge.photos')}
        mode="photo"
        entries={mediaEntries(hasPhotos)}
        failed={poolFailed}
      />
      <Section
        title={t('extras.featured.sections.videos')}
        icon={<Video className={icon} aria-hidden />}
        badge={t('extras.featured.badge.videos')}
        mode="video"
        entries={mediaEntries(hasVideos)}
        failed={poolFailed}
      />
      <Section
        title={t('extras.featured.sections.beforeAfter')}
        icon={<ArrowLeftRight className={icon} aria-hidden />}
        badge={t('extras.featured.badge.beforeAfter')}
        mode="beforeAfter"
        entries={mediaEntries(hasBeforeAfter)}
        failed={poolFailed}
      />
    </div>
  );
}
