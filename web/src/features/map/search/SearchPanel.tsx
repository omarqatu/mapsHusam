import { useTranslation } from 'react-i18next';
import Tabs from '@/components/ui/Tabs';
import MapSheet from '../panels/MapSheet';
import NearbyTab from './NearbyTab';
import QuickTab from './QuickTab';
import SmartTab from './SmartTab';
import { useSearchUi, type SearchTab } from './store';

const TAB_DEFS: SearchTab[] = ['quick', 'smart', 'nearby'];

/** The three structured searches in one panel. Kept mounted while open so half-built searches survive tab switches. */
export default function SearchPanel() {
  const { t } = useTranslation();
  const open = useSearchUi((s) => s.panelOpen);
  const tab = useSearchUi((s) => s.tab);
  const setTab = useSearchUi((s) => s.setTab);
  const close = useSearchUi((s) => s.closePanel);
  if (!open) return null;

  return (
    <MapSheet side="end" label={t('search.title')} title={t('search.title')} onClose={close}>
      <Tabs
        className="mb-4"
        tabs={TAB_DEFS.map((id) => ({ id, label: t(`search.tabs.${id}`) }))}
        value={tab}
        onChange={setTab}
        label={t('search.title')}
        idPrefix="search"
      />
      {TAB_DEFS.map((id) => (
        <div
          key={id}
          role="tabpanel"
          id={`search-tabpanel-${id}`}
          aria-labelledby={`search-tab-${id}`}
          hidden={tab !== id}
        >
          {id === 'quick' ? <QuickTab /> : id === 'smart' ? <SmartTab /> : <NearbyTab />}
        </div>
      ))}
    </MapSheet>
  );
}
