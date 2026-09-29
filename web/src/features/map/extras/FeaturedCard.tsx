import { MapPin, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MediaGallery from '@/components/ui/MediaGallery';
import {
  detailLinks,
  hoursLabel,
  isOpenNow,
  labelMedia,
  priceLabel,
  text,
  type Props,
} from '../popup/featureModel';
import { formatDistance } from '../search/nearby';
import ResultContact from '../search/ResultContact';
import { isFuelStation, isRoadBarrier, targetIcon, targetLabelKey } from '../targets';
import { BarrierBadges, FuelBadges } from './StatusBadges';
import { mediaForMode, sideMedia, type FeaturedEntry, type FeaturedMode } from './featured';
import { useShowOnMap } from './useShowOnMap';

interface CardProps {
  entry: FeaturedEntry;
  mode: FeaturedMode;
  /** Small caption on the card: "Featured", "Top rated", "Near you"… */
  badge: string;
}

function BeforeAfter({ props }: { props: Props }) {
  const { t } = useTranslation();
  const [before, after] = detailLinks(props);
  const side = (label: string, url: string | null, labelKey: string) => (
    <div className="min-w-0 space-y-1">
      <div className="text-center text-xs font-bold text-slate-600">{label}</div>
      {url ? (
        <MediaGallery items={labelMedia(sideMedia(url, labelKey), t)} />
      ) : (
        <div className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-400">
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
export default function FeaturedCard({ entry, mode, badge }: CardProps) {
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
  const price = priceLabel(p, t, i18n.language);
  const area = text(p.area);
  const stars = ratings?.avg ?? r.rating;
  const media = mode === 'beforeAfter' ? null : labelMedia(mediaForMode(p, mode), t);

  return (
    <article className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {mode === 'beforeAfter' ? <BeforeAfter props={p} /> : media && <MediaGallery items={media} />}

      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
        <Star className="h-3 w-3" fill="currentColor" aria-hidden />
        <span>
          {badge} · {typeTitle}
        </span>
        {r.id && <span className="font-normal text-slate-400">#{r.id}</span>}
      </div>

      <h5 className="flex items-start gap-2 text-sm font-bold text-slate-800" dir="auto">
        <span aria-hidden className="text-lg leading-none">
          {targetIcon(r.target)}
        </span>
        {name}
      </h5>

      {place && (
        <div className="flex items-center gap-1 text-xs text-slate-500" dir="auto">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden /> {place}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        {stars > 0 && (
          <span className="inline-flex items-center gap-0.5 text-amber-600">
            <Star className="h-3 w-3" fill="currentColor" aria-hidden /> {stars}
            {ratings && <span className="text-slate-400">({ratings.total})</span>}
          </span>
        )}
        {hasStatus && (
          <span className={open ? 'text-green-700' : 'text-red-600'}>
            {open ? t('popup.openNow') : t('popup.closedNow')}
            {hoursLabel(p.work_hours, t, i18n.language) && ` · ${hoursLabel(p.work_hours, t, i18n.language)}`}
          </span>
        )}
        {price && <span className="font-semibold text-slate-700">{price}</span>}
        {area && (
          <span className="text-slate-600">
            {area} {t('map.areaUnit')}
          </span>
        )}
        {r.distance !== undefined && (
          <span className="font-semibold text-brand">{formatDistance(r.distance, t)}</span>
        )}
      </div>

      {isBarrier && <BarrierBadges props={p} />}
      {isFuel && <FuelBadges props={p} />}

      {text(p.des) && (
        <p className="line-clamp-3 text-xs text-slate-600" dir="auto">
          {text(p.des)}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <ResultContact r={r} showRequest className="contents" />
        <button
          type="button"
          onClick={() => showOnMap(r)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden /> {t('extras.featured.showOnMap')}
        </button>
      </div>
    </article>
  );
}
