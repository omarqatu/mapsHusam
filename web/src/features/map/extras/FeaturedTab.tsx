import { useMemo, type ReactNode } from 'react';
import { Image, LocateFixed, Star, ThumbsUp, Trophy, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import SectionCard from '@/components/ui/SectionCard';
import { CenteredSpinner } from '@/components/ui/Spinner';
import FeaturedCard from './FeaturedCard';
import { pickForSection, type FeaturedEntry, type FeaturedMode } from './featured';
import NearMeSection from './NearMeSection';
import { useFeaturedRows } from './useFeaturedRows';

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

/** One section; nothing at all once it is known to be empty (legacy hid empty sections). */
function Section({ title, icon: sectionIcon, badge, mode, entries, failed }: SectionProps) {
  const { t } = useTranslation();
  const shown = useMemo(() => (entries ? pickForSection(entries) : null), [entries]);
  if (!failed && shown?.length === 0) return null;
  return (
    <SectionCard title={title} icon={sectionIcon}>
      {failed ? (
        <AlertMessage type="error" message={t('extras.featured.failed')} />
      ) : shown === null ? (
        <CenteredSpinner minHeight="5rem" size="sm" />
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

/** Featured, top rated, recommended, photos and videos sections (legacy featured-services portal). */
export function FeaturedSections() {
  const { t } = useTranslation();
  const rows = useFeaturedRows();
  if (rows.allFailed) return <AlertMessage type="error" message={t('extras.featured.failed')} />;

  const sections: (Omit<SectionProps, 'entries' | 'failed'> & { key: Exclude<keyof typeof rows, 'allFailed'> })[] = [
    { key: 'featured', title: t('extras.featured.sections.featured'), icon: <Star className={icon} aria-hidden />, badge: t('extras.featured.badge.featured'), mode: 'all' },
    { key: 'topRated', title: t('extras.featured.sections.topRated'), icon: <Trophy className={icon} aria-hidden />, badge: t('extras.featured.badge.topRated'), mode: 'all' },
    { key: 'recommended', title: t('extras.featured.sections.recommended'), icon: <ThumbsUp className={icon} aria-hidden />, badge: t('extras.featured.badge.recommended'), mode: 'all' },
    { key: 'photos', title: t('extras.featured.sections.photos'), icon: <Image className={icon} aria-hidden />, badge: t('extras.featured.badge.photos'), mode: 'photo' },
    { key: 'videos', title: t('extras.featured.sections.videos'), icon: <Video className={icon} aria-hidden />, badge: t('extras.featured.badge.videos'), mode: 'video' },
  ];
  return (
    <>
      {sections.map(({ key, ...section }) => (
        <Section key={key} {...section} {...rows[key]} />
      ))}
    </>
  );
}

/** Featured-services portal (legacy "خدمات مميزة"): near me, then the sections. */
export default function FeaturedTab() {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t('extras.featured.intro')}</p>
      <SectionCard title={t('extras.featured.nearMe')} icon={<LocateFixed className={icon} aria-hidden />}>
        <NearMeSection />
      </SectionCard>
      <FeaturedSections />
    </div>
  );
}
