import { useEffect, useState } from 'react';
import { BarChart3, Fuel, Signpost, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Tabs, { type TabDef } from '@/components/ui/Tabs';
import MapSheet from '../panels/MapSheet';
import { useSearchUi } from '../search/store';
import { useMapUi } from '../store';
import FeaturedTab from './FeaturedTab';
import StatsTab from './StatsTab';
import StatusTab from './StatusTab';
import { EXTRAS_TABS, useExtrasUi, type ExtrasTab } from './store';

const TAB_ICON: Record<ExtrasTab, typeof Star> = {
  featured: Star,
  roads: Signpost,
  fuel: Fuel,
  stats: BarChart3,
};

function renderTab(tab: ExtrasTab) {
  if (tab === 'featured') return <FeaturedTab />;
  if (tab === 'roads') return <StatusTab layer="road_barriers" />;
  if (tab === 'fuel') return <StatusTab layer="fuel_stations" />;
  return <StatsTab />;
}

/**
 * Featured services + live road / fuel status + platform statistics, in one panel on the map's end edge.
 * A tab loads its data the first time it is shown and then stays mounted, so its scroll and inputs survive tab switches.
 */
export default function ExtrasPanel() {
  const { t } = useTranslation();
  const open = useExtrasUi((s) => s.open);
  const tab = useExtrasUi((s) => s.tab);
  const setTab = useExtrasUi((s) => s.setTab);
  const close = useExtrasUi((s) => s.closePanel);
  const [visited, setVisited] = useState<ReadonlySet<ExtrasTab>>(new Set());
  // Tabs shown so far (adjust state while rendering — no effect needed).
  if (open && !visited.has(tab)) setVisited(new Set(visited).add(tab));

  // One sheet at a time on the end edge (search and layer panels take the same place); on phones the details card and
  // a new result list also need the room.
  useEffect(() => {
    const shut = () => useExtrasUi.getState().closePanel();
    const phone = () => window.innerWidth < 640;
    const offMap = useMapUi.subscribe((s, prev) => {
      if (s.layersOpen && !prev.layersOpen) shut();
      if (phone() && s.selected && s.selected !== prev.selected) shut();
    });
    const offSearch = useSearchUi.subscribe((s, prev) => {
      if (s.panelOpen && !prev.panelOpen) shut();
      if (phone() && s.results && s.results.version !== prev.results?.version) shut();
    });
    // Escape closes the panel only when no card / result list is above it (the page handler closes those first;
    // this listener runs before it, so it sees the state as it was when Escape was pressed).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (useMapUi.getState().selected || useSearchUi.getState().results) return;
      if (useExtrasUi.getState().open) shut();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      offMap();
      offSearch();
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) return null;

  const tabs: TabDef<ExtrasTab>[] = EXTRAS_TABS.map((id) => {
    const Icon = TAB_ICON[id];
    return { id, label: t(`extras.tabs.${id}`), icon: <Icon className="h-4 w-4" aria-hidden /> };
  });

  return (
    <MapSheet side="end" label={t('extras.title')} title={t('extras.title')} onClose={close}>
      <Tabs className="mb-4" tabs={tabs} value={tab} onChange={setTab} label={t('extras.title')} idPrefix="extras" />
      {EXTRAS_TABS.map((id) => (
        <div
          key={id}
          role="tabpanel"
          id={`extras-tabpanel-${id}`}
          aria-labelledby={`extras-tab-${id}`}
          hidden={tab !== id}
        >
          {(visited.has(id) || tab === id) && renderTab(id)}
        </div>
      ))}
    </MapSheet>
  );
}
