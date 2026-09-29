import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import MapSheet from '../panels/MapSheet';
import NearbyTab from './NearbyTab';
import QuickTab from './QuickTab';
import SmartTab from './SmartTab';
import { useSearchUi, type SearchTab } from './store';

const TABS: SearchTab[] = ['quick', 'smart', 'nearby'];

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
      <div
        role="tablist"
        aria-label={t('search.title')}
        className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1"
      >
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            id={`search-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`search-tabpanel-${id}`}
            onClick={() => setTab(id)}
            className={clsx(
              'rounded-md px-2 py-2 text-sm font-semibold',
              tab === id ? 'bg-white text-brand shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {t(`search.tabs.${id}`)}
          </button>
        ))}
      </div>
      {TABS.map((id) => (
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
