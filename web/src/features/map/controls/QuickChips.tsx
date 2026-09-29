import { Fuel, ListFilter, Star, TrafficCone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { useExtrasUi, type ExtrasTab } from '../extras/store';
import { useSearchUi } from '../search/store';
import { useMapUi } from '../store';

const chip =
  'glass inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-fg hover:bg-surface/90 focus-visible:outline-2 focus-visible:outline-brand';

/**
 * One-tap shortcuts under the search box (legacy had these as four coloured buttons on top of the map): road and fuel
 * status are what people open the map for. They open the extras panel on the right tab; the rest stays in the panel.
 */
export default function QuickChips() {
  const { t } = useTranslation();
  const open = (tab: ExtrasTab) => {
    useMapUi.getState().setLayersOpen(false);
    useSearchUi.getState().closePanel();
    useExtrasUi.getState().openPanel(tab);
  };
  const button = (tab: ExtrasTab, icon: ReactNode, label: string) => (
    <button type="button" className={chip} onClick={() => open(tab)}>
      {icon}
      {label}
    </button>
  );
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:justify-center [&::-webkit-scrollbar]:hidden">
      {button('fuel', <Fuel className="h-4 w-4 text-info" aria-hidden />, t('extras.chips.fuel'))}
      {button('roads', <TrafficCone className="h-4 w-4 text-warn" aria-hidden />, t('extras.chips.roads'))}
      {button('featured', <Star className="h-4 w-4 text-warn" aria-hidden />, t('extras.chips.featured'))}
      {/* The header already has "search" from tablet width up; phones keep the shortcut. */}
      <Link to="/search" className={`${chip} md:hidden`}>
        <ListFilter className="h-4 w-4 text-ok" aria-hidden />
        {t('extras.chips.search')}
      </Link>
    </div>
  );
}
