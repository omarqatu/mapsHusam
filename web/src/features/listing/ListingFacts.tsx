import type { ReactNode } from 'react';
import {
  Banknote,
  Calculator,
  CalendarDays,
  CircleCheck,
  Clock,
  Hash,
  Images,
  Landmark,
  MapPin,
  Maximize,
  RefreshCw,
  Star,
  Video,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { VisualItem } from '@/components/ui/MediaGallery';
import { formatDate, formatNumber } from '@/lib/format';
import TargetIcon from '../map/TargetIcon';
import { manualStars } from '../map/extras/featured';
import {
  AVAILABILITY_TONE,
  availability,
  availabilityLabelKey,
  hoursLabel,
  priceLabel,
  text,
} from '../map/popup/featureModel';
import type { SearchResult } from '../map/search/results';
import { hasPrice, isRoadBarrier, priceCurrencyDefault, targetLabelKey } from '../map/targets';
import { listingDate, pricePerMeter } from './model';

interface Fact {
  key: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  /** Colour of the value (availability). */
  tone?: string;
}

/** One fact as a plain row: a small icon and the label, the value at the other end; a thin rule under it. */
function FactRow({ icon, label, value, tone }: Omit<Fact, 'key'>) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5">
      <dt className="flex shrink-0 items-center gap-2 text-sm text-muted">
        <span className="text-brand-fg [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd
        className="min-w-0 text-end text-sm font-bold break-words text-fg"
        style={tone ? { color: tone } : undefined}
        dir="auto"
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The listing's key facts as a plain two-column list of rows (type, number, price, area, price per m², state, hours, place,
 * posting / update dates, media, rating). A fact the listing does not have is left out, never shown as a dash.
 */
export default function ListingFacts({ r, visual }: { r: SearchResult; visual: VisualItem[] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const p = r.props;
  const priced = hasPrice(r.target);
  const currencyDefault = priceCurrencyDefault(r.target);
  const price = priced ? priceLabel(p, t, lang, currencyDefault) : null;
  const area = priced && Number(p.area) > 0 ? Number(p.area) : null;
  // A sale's price per m² is what buyers compare; for a rent or a service it means nothing.
  const forSale = r.target.kind === 'realEstate' && r.target.layer !== 'rent';
  const perMeter = price && forSale ? pricePerMeter(p) : null;
  const state = isRoadBarrier(r.target) ? null : availability(p);
  const hours = r.target.kind === 'service' ? hoursLabel(p.work_hours, t, lang) : '';
  const posted = listingDate(p.start_date);
  const updated = listingDate(p.updated_at);
  const pictures = visual.filter((m) => m.type === 'image').length;
  const videos = visual.length - pictures;
  const stars = manualStars(r.rating);

  const facts: (Fact | false)[] = [
    {
      key: 'type',
      icon: <TargetIcon target={r.target} />,
      label: t('listing.page.type'),
      value: t(targetLabelKey(r.target)),
    },
    r.id !== null && { key: 'id', icon: <Hash />, label: t('listing.page.number'), value: `#${r.id}` },
    !!price && { key: 'price', icon: <Banknote />, label: t('listing.page.price'), value: price },
    area !== null && {
      key: 'area',
      icon: <Maximize />,
      label: t('listing.page.area'),
      value: `${formatNumber(area, lang)} ${t('map.areaUnit')}`,
    },
    perMeter !== null && {
      key: 'perMeter',
      icon: <Calculator />,
      label: t('listing.page.pricePerMeter'),
      value: priceLabel({ ...p, price: perMeter }, t, lang, currencyDefault),
    },
    !!state && {
      key: 'state',
      icon: <CircleCheck />,
      label: t('listing.page.state'),
      value: t(availabilityLabelKey(state)),
      tone: AVAILABILITY_TONE[state],
    },
    !!hours && { key: 'hours', icon: <Clock />, label: t('listing.page.hours'), value: hours },
    !!(text(p.location_name) || text(p.location)) && {
      key: 'place',
      icon: <MapPin />,
      label: t('listing.page.place'),
      value: text(p.location_name) || text(p.location),
    },
    !!text(p.village_a) && {
      key: 'town',
      icon: <MapPin />,
      label: t('listing.page.town'),
      value: text(p.village_a),
    },
    !!text(p.gov_a) && {
      key: 'gov',
      icon: <Landmark />,
      label: t('listing.page.governorate'),
      value: text(p.gov_a),
    },
    !!posted && {
      key: 'posted',
      icon: <CalendarDays />,
      label: t('listing.page.posted'),
      value: formatDate(posted, lang),
    },
    !!updated && {
      key: 'updated',
      icon: <RefreshCw />,
      label: t('listing.page.updated'),
      value: formatDate(updated, lang),
    },
    pictures > 0 && {
      key: 'pictures',
      icon: <Images />,
      label: t('listing.page.pictures'),
      value: formatNumber(pictures, lang),
    },
    videos > 0 && {
      key: 'videos',
      icon: <Video />,
      label: t('listing.page.videos'),
      value: formatNumber(videos, lang),
    },
    stars > 0 && {
      key: 'rating',
      icon: <Star />,
      label: t('listing.page.rating'),
      value: `${formatNumber(stars, lang)} / 5`,
    },
  ];

  return (
    <dl className="grid gap-x-8 sm:grid-cols-2">
      {facts
        .filter((f): f is Fact => !!f)
        .map(({ key, ...f }) => (
          <FactRow key={key} {...f} />
        ))}
    </dl>
  );
}
