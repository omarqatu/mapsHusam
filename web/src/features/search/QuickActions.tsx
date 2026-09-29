import { Fuel, Map as MapIcon, Signpost } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

interface Props {
  onRoads: () => void;
  onFuel: () => void;
}

const chip =
  'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold shadow-sm focus-visible:outline-2 focus-visible:outline-brand';

/** Always under the search box (legacy: the three coloured buttons of the page header): map, road status, fuel status. */
export default function QuickActions({ onRoads, onFuel }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link to="/" className={`${chip} border-brand bg-brand text-white hover:bg-brand-hover md:hidden`}>
        <MapIcon className="h-4 w-4" aria-hidden /> {t('searchPage.goToMap')}
      </Link>
      <button type="button" onClick={onRoads} className={`${chip} border-warn-line bg-warn-soft text-warn hover:bg-warn-soft`}>
        <Signpost className="h-4 w-4" aria-hidden /> {t('searchPage.roadStatus')}
      </button>
      <button type="button" onClick={onFuel} className={`${chip} border-info-line bg-info-soft text-info hover:bg-info-soft`}>
        <Fuel className="h-4 w-4" aria-hidden /> {t('searchPage.fuelStatus')}
      </button>
    </div>
  );
}
