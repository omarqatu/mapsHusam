import { useState } from 'react';
import clsx from 'clsx';
import { MapPin, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MediaGallery from '@/components/ui/MediaGallery';
import RatingSummary from '@/components/ui/RatingSummary';
import {
  detailLinks,
  hoursLabel,
  isOpenNow,
  labelMedia,
  priceLabel,
  text,
  type Props,
} from '../popup/featureModel';
import RatingsBlock from '../popup/RatingsBlock';
import { formatDistance } from '../search/nearby';
import ResultContact from '../search/ResultContact';
import { hasPrice, isFuelStation, isRoadBarrier, priceCurrencyDefault, targetIcon, targetLabelKey } from '../targets';
import { BarrierBadges, FuelBadges } from './StatusBadges';
import { manualStars, mediaForMode, sideMedia, type FeaturedEntry, type FeaturedMode } from './featured';
import { FEATURED_FRAME } from './featuredStyle';
import { useShowOnMap } from './useShowOnMap';

interface CardProps {
  entry: FeaturedEntry;
  mode: FeaturedMode;
  /** Small caption on the card: "Featured", "Top rated", "Near you"… (none on plain result lists). */
  badge?: string;
  /** Extra line under the name, e.g. why a keyword search matched ("closed, inbound"). */
  note?: string;
  /** Services: show the real customers' average + comments (one request per card) instead of the `rating` column. */
  customerRatings?: boolean;
  /** A paid placement: the featured frame (see featuredStyle). */
  highlight?: boolean;
  /** Inside a dialog (the search preview): no frame of its own, and no name (the dialog's title carries it). */
  bare?: boolean;
}

const LONG_DESCRIPTION = 160;

/** Description clamped to three lines, with a toggle when it is long. */
function Description({ value }: { value: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const long = value.length > LONG_DESCRIPTION;
  return (
    <div>
      <p className={open || !long ? 'text-sm text-fg' : 'line-clamp-2 text-sm text-fg'} dir="auto">
        {value}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-0.5 text-sm font-semibold text-brand-fg hover:underline"
        >
          {open ? t('common.showLess') : t('common.showMore')}
        </button>
      )}
    </div>
  );
}

function BeforeAfter({ props }: { props: Props }) {
  const { t } = useTranslation();
  const [before, after] = detailLinks(props);
  const side = (label: string, url: string | null, labelKey: string) => (
    <div className="min-w-0 space-y-1">
      <div className="text-center text-sm font-bold text-muted">{label}</div>
      {url ? (
        <MediaGallery items={labelMedia(sideMedia(url, labelKey), t)} />
      ) : (
        <div className="rounded-lg bg-subtle p-3 text-center text-sm text-muted">
          {t('extras.featured.none')}
        </div>
      )}
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {side(t('extras.featured.before'), before, 'popup.moreDetails1')}
      {side(t('extras.featured.after'), after, 'popup.moreDetails2')}
    </div>
  );
}

/** One provider / property in the featured portal: media, key facts, status, contact and "show on map". */
export default function FeaturedCard({ entry, mode, badge, note, customerRatings, highlight, bare }: CardProps) {
  const { t, i18n } = useTranslation();
  const showOnMap = useShowOnMap();
  const { r, ratings } = entry;
  const p = r.props;
  const isBarrier = isRoadBarrier(r.target);
  const isFuel = isFuelStation(r.target);
  const typeTitle = t(targetLabelKey(r.target));
  const name = text(p.name) || text(p.location_name) || typeTitle;
  const place = [text(p.location_name) || text(p.location), text(p.village_a), text(p.gov_a)]
    .filter(Boolean)
    .join(' · ');
  const hasStatus = !isBarrier && text(p.auto_status) !== '';
  const open = isOpenNow(p.auto_status);
  const priced = hasPrice(r.target);
  const price = priced ? priceLabel(p, t, i18n.language, priceCurrencyDefault(r.target)) : null;
  const area = priced && Number(p.area) > 0 ? text(p.area) : '';
  const stars = ratings?.avg ?? manualStars(r.rating);
  const media = mode === 'beforeAfter' ? null : labelMedia(mediaForMode(p, mode), t);
  const showCustomerRatings = !!customerRatings && r.target.kind === 'service' && !!r.id;

  return (
    <article
      className={clsx(
        'flex h-full flex-col gap-2',
        !bare && 'rounded-xl border p-3 shadow-sm',
        !bare && (highlight ? FEATURED_FRAME : 'border-line bg-surface'),
      )}
    >
      {mode === 'beforeAfter' ? <BeforeAfter props={p} /> : media && <MediaGallery items={media} />}

      <div className="flex items-center gap-1.5 text-sm font-bold text-warn">
        {badge && <Star className="h-3.5 w-3.5" fill="currentColor" aria-hidden />}
        <span>{badge ? `${badge} · ${typeTitle}` : typeTitle}</span>
        {r.id && <span className="font-normal text-muted">#{r.id}</span>}
      </div>

      {!bare && (
        <h5 className="flex items-start gap-2 text-base font-bold text-fg" dir="auto">
          <span aria-hidden className="text-lg leading-none">
            {targetIcon(r.target)}
          </span>
          {name}
        </h5>
      )}

      {note && <p className="text-sm font-semibold text-brand-fg">{note}</p>}

      {place && (
        <div className="flex items-center gap-1 text-sm text-muted" dir="auto">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /> {place}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {!showCustomerRatings && stars > 0 && (
          <RatingSummary value={stars} count={ratings?.total} />
        )}
        {hasStatus && (
          <span className={open ? 'text-ok' : 'text-danger'}>
            {open ? t('popup.openNow') : t('popup.closedNow')}
            {hoursLabel(p.work_hours, t, i18n.language) && ` · ${hoursLabel(p.work_hours, t, i18n.language)}`}
          </span>
        )}
        {price && <span className="text-base font-black text-brand-fg">{price}</span>}
        {area && (
          <span className="text-muted">
            {area} {t('map.areaUnit')}
          </span>
        )}
        {r.distance !== undefined && (
          <span className="font-semibold text-brand-fg">{formatDistance(r.distance, t)}</span>
        )}
      </div>

      {isBarrier && <BarrierBadges props={p} />}
      {isFuel && <FuelBadges props={p} />}

      {showCustomerRatings && r.target.kind === 'service' && (
        <RatingsBlock layer={r.target.discriminator} featureId={r.id ?? ''} />
      )}

      {text(p.des) && <Description value={text(p.des)} />}

      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <ResultContact r={r} showRequest className="contents" />
        <button
          type="button"
          onClick={() => showOnMap(r)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-fg hover:bg-subtle"
        >
          <MapPin className="h-4 w-4" aria-hidden /> {t('extras.featured.showOnMap')}
        </button>
      </div>
    </article>
  );
}
