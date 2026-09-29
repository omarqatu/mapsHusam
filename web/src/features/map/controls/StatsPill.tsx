import { Layers, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlatformStats } from '@/api/platform';
import { formatNumber } from '@/lib/format';

/**
 * The two figures that matter, always in view at the bottom of the map (legacy: a bar of six counters): how many
 * service providers and how many service types. Visits and user counts stay in the stats tab of the extras panel.
 */
export default function StatsPill() {
  const { t, i18n } = useTranslation();
  const s = usePlatformStats().data;
  if (!s) return null;
  const item = (icon: React.ReactNode, value: number, label: string) => (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      {icon}
      <b className="text-sm text-fg">{formatNumber(value, i18n.language)}</b>
      <span>{label}</span>
    </span>
  );
  return (
    <div
      className="glass pointer-events-none hidden items-center gap-3 rounded-full px-3 py-1 text-xs font-semibold text-fg sm:flex"
      aria-label={t('extras.tabs.stats')}
    >
      {item(<MapPin className="h-3.5 w-3.5 text-danger" aria-hidden />, s.featuresCount, t('extras.stats.providers'))}
      <span className="h-3 w-px bg-line-strong" aria-hidden />
      {item(<Layers className="h-3.5 w-3.5 text-warn" aria-hidden />, s.servicesCount, t('extras.stats.services'))}
    </div>
  );
}
