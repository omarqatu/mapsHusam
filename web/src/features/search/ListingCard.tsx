import { useState } from 'react';
import clsx from 'clsx';
import { MapPin, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { playBadge, ytThumb } from '@/components/ui/media';
import RatingSummary from '@/components/ui/RatingSummary';
import type { VisualItem } from '@/components/ui/MediaGallery';
import { useServiceRatings } from '@/api/mapEvents';
import { useInView } from '@/hooks/useInView';
import {
  customerRatingsKey,
  groupOf,
  manualStars,
  mediaForMode,
  type FeaturedEntry,
  type FeaturedMode,
} from '../map/extras/featured';
import { FEATURED_FRAME } from '../map/extras/featuredStyle';
import { BarrierBadges, FuelBadges } from '../map/extras/StatusBadges';
import { useShowOnMap } from '../map/extras/useShowOnMap';
import {
  availability,
  beforeAfterPair,
  mediaDefault,
  priceLabel,
  sideMedia,
  text,
  type MediaItem,
} from '../map/popup/featureModel';
import { AvailabilityText } from '../map/popup/AvailabilityText';
import { formatDistance } from '../map/search/nearby';
import ResultContact from '../map/search/ResultContact';
import { hasPrice, isFuelStation, isRoadBarrier, priceCurrencyDefault, targetLabelKey } from '../map/targets';
import { GROUP_ART } from './art';
import ListingPreview from './ListingPreview';
import DirectionsButton from '../map/popup/DirectionsButton';
import TargetIcon from '@/features/map/TargetIcon';

interface Props {
  entry: FeaturedEntry;
  /** Which media the picture area shows: `all` = what the provider chose (first picture, or before / after side by side). */
  mode?: FeaturedMode;
  /** Small caption over the picture: "Featured", "Top rated"… */
  badge?: string;
  /** Why a keyword search matched ("closed, inbound"). */
  note?: string;
  /** A paid placement: the featured frame (see featuredStyle). */
  highlight?: boolean;
  /**
   * Services show their customers' real average instead of the hand-set `rating` column (as the map's featured cards
   * do), fetched once the card comes into view. Off by default: result lists can hold hundreds of cards.
   */
  customerRatings?: boolean;
  /** Result lists: a row (thumbnail beside the text) on phones, so a screen holds several results. */
  rowOnPhone?: boolean;
  className?: string;
}

/**
 * The customers' average, asked for once `seen` (the card came into view); "no ratings yet" when there are none.
 * Loading and failures show nothing: ratings are a bonus and must not clutter the card.
 */
function LiveRating({ layer, featureId, seen }: { layer: string; featureId: string; seen: boolean }) {
  const { t } = useTranslation();
  const { data } = useServiceRatings(seen ? layer : null, seen ? featureId : null);
  if (!data) return null;
  return data.totalRatings > 0 ? (
    <RatingSummary value={data.averageRating} count={data.totalRatings} />
  ) : (
    <span className="text-muted">{t('popup.rating.none')}</span>
  );
}

const visuals = (items: MediaItem[]) => items.filter((m): m is VisualItem => m.type !== 'link');

function Thumb({ m, onBroken }: { m: VisualItem; onBroken?: () => void }) {
  if (m.type === 'image')
    return (
      <img
        src={m.url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={onBroken}
        className="h-full w-full object-cover"
      />
    );
  if (m.type === 'youtube')
    return (
      <img
        src={ytThumb(m.id)}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
      />
    );
  return (
    <video
      src={`${m.url}#t=0.5`}
      preload="metadata"
      muted
      playsInline
      className="h-full w-full object-cover"
    />
  );
}

/**
 * A listing the way a classifieds site shows one: picture first (or its section's illustration), name, place, price or
 * opening state, and one row of actions (contact, map). The whole card opens the preview with everything else; the
 * action buttons sit above that click area. One card for the landing rows and every result list.
 */
export default function ListingCard({
  entry,
  mode = 'all',
  badge,
  note,
  highlight,
  customerRatings,
  rowOnPhone,
  className,
}: Props) {
  const { t, i18n } = useTranslation();
  const showOnMap = useShowOnMap();
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const { r, ratings } = entry;
  const p = r.props;
  const typeTitle = t(targetLabelKey(r.target));
  const name = text(p.name) || text(p.location_name) || typeTitle;
  // The place people recognise (street / area, town); the governorate is only a fallback.
  const place =
    [text(p.location_name) || text(p.location), text(p.village_a)].filter(Boolean).join(' · ') ||
    text(p.gov_a);
  const priced = hasPrice(r.target);
  const price = priced ? priceLabel(p, t, i18n.language, priceCurrencyDefault(r.target)) : null;
  const area = priced && Number(p.area) > 0 ? text(p.area) : '';
  const state = isRoadBarrier(r.target) ? null : availability(p);
  const ratingsKey = customerRatings && !ratings ? customerRatingsKey(r) : null;
  // The card itself is watched: an empty rating slot has no box, and a box-less element is never "in view".
  const [cardRef, seen] = useInView<HTMLElement>();
  const notBroken = (m: VisualItem) => !(m.type === 'image' && broken.has(m.url));
  const markBroken = (m: VisualItem) => () => m.type === 'image' && setBroken((b) => new Set(b).add(m.url));

  // The provider's choice: their before / after pair side by side, or their first picture.
  const pair = mode === 'all' && mediaDefault(p) === 'beforeAfter' ? beforeAfterPair(p) : null;
  const sides = pair
    ? [sideMedia(pair.before, 'popup.moreDetails1'), sideMedia(pair.after, 'popup.moreDetails2')].map(
        (s) => visuals(s).filter(notBroken)[0],
      )
    : null;
  const items = sides
    ? sides.filter((m): m is VisualItem => !!m)
    : visuals(mediaForMode(p, mode)).filter(notBroken);
  const first = items[0];
  const art = GROUP_ART[groupOf(r.target)];

  return (
    <article
      ref={ratingsKey ? cardRef : undefined}
      className={clsx(
        'group/card relative flex flex-col overflow-hidden rounded-xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-float',
        highlight ? FEATURED_FRAME : 'border-line bg-surface hover:border-brand',
        rowOnPhone && 'max-sm:grid max-sm:grid-cols-[6.5rem_minmax(0,1fr)] max-sm:hover:translate-y-0',
        className,
      )}
    >
      <div
        className={clsx(
          'relative aspect-[16/10] overflow-hidden bg-brand-light',
          rowOnPhone && 'max-sm:aspect-auto max-sm:h-full max-sm:min-h-28',
        )}
      >
        {sides ? (
          <div className="grid h-full grid-cols-2 gap-0.5">
            {sides.map((m, i) => (
              <div key={i} className="relative h-full bg-subtle">
                {m ? (
                  <>
                    <Thumb m={m} onBroken={markBroken(m)} />
                    {m.type !== 'image' && playBadge}
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">
                    {t('extras.featured.none')}
                  </div>
                )}
                <span className="absolute bottom-1.5 start-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">
                  {t(i === 0 ? 'media.before' : 'media.after')}
                </span>
              </div>
            ))}
          </div>
        ) : first ? (
          <>
            <Thumb m={first} onBroken={markBroken(first)} />
            {first.type !== 'image' && playBadge}
          </>
        ) : art ? (
          <div className="relative h-full" aria-hidden>
            <img
              src={art}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover object-left-bottom opacity-60 saturate-50"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface/95 text-3xl shadow-float max-sm:h-11 max-sm:w-11 max-sm:text-2xl">
                <TargetIcon target={r.target} />
              </span>
            </span>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-5xl" aria-hidden>
            <TargetIcon target={r.target} />
          </div>
        )}
        {badge && (
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2 py-0.5 text-xs font-bold text-warn shadow-sm">
            <Star className="h-3 w-3" fill="currentColor" aria-hidden /> {badge}
          </span>
        )}
        {!sides && items.length > 1 && (
          <span
            className="absolute bottom-2 end-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white"
            dir="ltr"
          >
            +{items.length - 1}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden><TargetIcon target={r.target} /></span>
          <span className="truncate">{typeTitle}</span>
          {r.id && <span className="ms-auto shrink-0">#{r.id}</span>}
        </div>
        <h3 className="line-clamp-1 text-base font-bold text-fg" dir="auto" title={name}>
          {/* The card's one big click target: stretched over the whole card (the actions below sit above it). */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-start after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brand"
          >
            {name}
          </button>
        </h3>
        {note && <p className="text-sm font-semibold text-brand-fg">{note}</p>}
        {place && (
          <p className="flex items-center gap-1 text-sm text-muted" dir="auto">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{place}</span>
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-1 text-sm">
          {price && <span className="text-base font-black text-brand-fg">{price}</span>}
          {area && (
            <span className="text-muted">
              {area} {t('map.areaUnit')}
            </span>
          )}
          {ratingsKey ? (
            <LiveRating layer={ratingsKey.layer} featureId={ratingsKey.featureId} seen={seen} />
          ) : (
            (ratings || r.rating > 0) && (
              <RatingSummary value={ratings ? ratings.avg : manualStars(r.rating)} count={ratings?.total} />
            )
          )}
          {state && <AvailabilityText value={state} className="font-semibold" />}
          {r.distance !== undefined && (
            <span className="font-semibold text-brand-fg">{formatDistance(r.distance, t)}</span>
          )}
        </div>
        {isRoadBarrier(r.target) && <BarrierBadges props={p} />}
        {isFuelStation(r.target) && <FuelBadges props={p} />}
      </div>

      <div
        className={clsx(
          'relative z-10 flex items-center gap-1.5 border-t border-line px-3 py-2',
          rowOnPhone && 'max-sm:col-span-2',
        )}
      >
        <ResultContact r={r} showRequest className="contents" />
        <button
          type="button"
          onClick={() => showOnMap(r)}
          aria-label={t('extras.featured.showOnMap')}
          title={t('extras.featured.showOnMap')}
          className="ms-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface text-fg hover:bg-subtle"
        >
          <MapPin className="h-4 w-4" aria-hidden />
        </button>
        {!isRoadBarrier(r.target) && <DirectionsButton coordinate={r.center} iconOnly />}
      </div>

      {open && (
        <ListingPreview entry={entry} mode={mode} badge={badge} note={note} onClose={() => setOpen(false)} />
      )}
    </article>
  );
}
