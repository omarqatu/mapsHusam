import type { ReactNode } from 'react';
import { Eye, Layers, MapPin, MapPinned, ScanSearch, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlatformStats, type PlatformStats } from '@/api/platform';
import AlertMessage from '@/components/ui/AlertMessage';
import DataField from '@/components/ui/DataField';
import { CenteredSpinner } from '@/components/ui/Spinner';
import SectionCard from '@/components/ui/SectionCard';
import StatCard from '@/components/ui/StatCard';
import { formatNumber } from '@/lib/format';

interface Tile {
  key: string;
  labelKey: string;
  value: (s: PlatformStats) => number;
  icon: ReactNode;
  // Full class names (Tailwind only generates what it sees written out).
  chip: string;
  tile: string;
}

const icon = 'h-4 w-4';
const TILES: Tile[] = [
  {
    key: 'users',
    labelKey: 'extras.stats.users',
    value: (s) => s.usersTotal,
    icon: <Users className={icon} />,
    chip: 'bg-info-solid',
    tile: 'bg-info-soft text-info',
  },
  {
    key: 'providers',
    labelKey: 'extras.stats.providers',
    value: (s) => s.featuresCount,
    icon: <MapPin className={icon} />,
    chip: 'bg-danger-solid',
    tile: 'bg-danger-soft text-danger',
  },
  {
    key: 'services',
    labelKey: 'extras.stats.services',
    value: (s) => s.servicesCount,
    icon: <Layers className={icon} />,
    chip: 'bg-warn-solid',
    tile: 'bg-warn-soft text-warn',
  },
  {
    key: 'viewsTotal',
    labelKey: 'extras.stats.viewsTotal',
    value: (s) => s.viewsTotal,
    icon: <Eye className={icon} />,
    chip: 'bg-ok-solid',
    tile: 'bg-ok-soft text-ok',
  },
  {
    key: 'viewsMap',
    labelKey: 'extras.stats.viewsMap',
    value: (s) => s.viewsMap,
    icon: <MapPinned className={icon} />,
    chip: 'bg-ok-solid',
    tile: 'bg-ok-soft text-ok',
  },
  {
    key: 'viewsQuick',
    labelKey: 'extras.stats.viewsQuick',
    value: (s) => s.viewsQuickSearch,
    icon: <ScanSearch className={icon} />,
    chip: 'bg-ok-solid',
    tile: 'bg-ok-soft text-ok',
  },
];

/** Platform counters (legacy bottom bar / mobile "home" tab): users, providers, services, visits. */
export default function StatsTab() {
  const { t, i18n } = useTranslation();
  const stats = usePlatformStats();
  const fmt = (n: number) => formatNumber(Number(n) || 0, i18n.language);

  if (stats.isPending) return <CenteredSpinner minHeight="8rem" />;
  if (stats.isError) return <AlertMessage type="error" message={t('extras.stats.failed')} />;
  const s = stats.data;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {TILES.map((tile) => (
          <StatCard
            key={tile.key}
            label={t(tile.labelKey)}
            value={fmt(tile.value(s))}
            icon={tile.icon}
            chipClassName={tile.chip}
            tileClassName={tile.tile}
          />
        ))}
      </div>
      <SectionCard title={t('extras.stats.usersByRole')} icon={<Users className="h-4 w-4" aria-hidden />}>
        <div className="grid grid-cols-3 gap-3">
          <DataField label={t('roles.admin')} value={fmt(s.usersAdmin)} />
          <DataField label={t('roles.user')} value={fmt(s.usersUser)} />
          <DataField label={t('roles.provider')} value={fmt(s.usersProvider)} />
        </div>
      </SectionCard>
    </div>
  );
}
