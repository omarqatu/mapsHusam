import { useEffect, useId, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Handshake, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import RatingSummary from '@/components/ui/RatingSummary';
import Tabs from '@/components/ui/Tabs';
import { useLayerFilter } from '../visibility/store';
import type { Coordinate } from '../map/config';
import { useShowOnMap } from '../map/extras/useShowOnMap';
import { AvailabilityText } from '../map/popup/AvailabilityText';
import { availabilityLabelKey, text, type Props } from '../map/popup/featureModel';
import { formatDistance } from '../map/search/nearby';
import ResultContact from '../map/search/ResultContact';
import { listingLayerOf, targetFromKey, targetLabelKey, type MapTarget } from '../map/targets';
import { servicesFor } from './model';
import {
  RADII_KM,
  trackPropertyServices,
  trackPropertyServicesOnce,
  usePropertyServicesConfig,
  useTypeProviders,
  useTypeRatings,
} from './queries';
import { rankProviders, type RankedProvider } from './rank';
import TargetIcon from '@/features/map/TargetIcon';

/** Providers shown at first, and after "show more". A card is not a directory: three answers, then a way to see more. */
const TOP = 3;
const MORE = 10;

interface Tracker {
  contact: (channel: 'call' | 'whatsapp') => void;
  request: () => void;
}

function ProviderRow({ p, track }: { p: RankedProvider; track: Tracker }) {
  const { t } = useTranslation();
  const showOnMap = useShowOnMap();
  const props = p.r.props;
  const place = text(props.village_a) || text(props.gov_a);
  return (
    <li className="space-y-1.5 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 break-words text-base font-bold text-fg" dir="auto">
          {text(props.name) || t('popup.provider')}
        </h4>
        {/* Closed right now is information, not a warning: a surveyor is not a restaurant (it ranks one step lower, no more). */}
        {p.state === 'closed' ? (
          <span className="shrink-0 text-sm text-muted">{t(availabilityLabelKey('closed'))}</span>
        ) : (
          p.state && <AvailabilityText value={p.state} className="shrink-0 text-sm font-semibold" />
        )}
      </div>
      <div className="text-sm">
        {p.rating ? (
          <RatingSummary value={p.rating.avg} count={p.rating.count} />
        ) : (
          <span className="text-muted">{t('popup.rating.none')}</span>
        )}
      </div>
      <p className="text-sm text-muted" dir="auto">
        {[place, t('propertyServices.fromLand', { distance: formatDistance(p.distance, t) })].filter(Boolean).join(' · ')}
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <ResultContact r={p.r} showRequest className="contents" onContact={track.contact} onRequest={track.request} />
        <button
          type="button"
          onClick={() => showOnMap(p.r)}
          title={t('extras.featured.showOnMap')}
          aria-label={t('extras.featured.showOnMap')}
          className="grid h-10 w-10 place-items-center rounded-lg border border-line text-fg hover:border-brand hover:text-brand-fg focus-visible:outline-2 focus-visible:outline-brand"
        >
          <MapPin className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

interface Props_ {
  /** The property this card is about (its kind decides which services are offered). */
  target: MapTarget;
  /** The property's id (feature id), for measurement; without it nothing is measured. */
  propertyId: string | null;
  /** A point on the property: the search starts around it and distances are measured from it, not from the visitor. */
  origin: Coordinate;
  /** The property's data (its governorate is the fallback when the radius finds too few). */
  props: Props;
  className?: string;
}

/**
 * "Services for this land": the kinds of provider a property buyer reaches for next (a surveyor, a valuer…), each with
 * who is best placed to help with THIS property — found around its point, the radius widening only while there are few,
 * then active first, best trusted rating, nearest. Collapsed to one line until asked; a type nobody offers is left
 * out, and nothing shows when no type has anyone. What people do here is measured (see queries.ts).
 */
export default function PropertyServices({ target, propertyId, origin, props, className }: Props_) {
  const { t } = useTranslation();
  const id = useId();
  const config = usePropertyServicesConfig();
  const shownToViewer = useLayerFilter();
  const types = useMemo(
    () => (config ? servicesFor(config, target).filter((type) => shownToViewer(type)) : []),
    [config, target, shownToViewer],
  );
  const gov = text(props.gov_a);
  const lists = useTypeProviders(types, origin, gov);

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  // Types with someone to offer, in the configured order.
  const offered = lists.filter((l) => l.nearby && l.nearby.providers.length > 0);
  const active = offered.find((l) => l.type === picked) ?? offered[0] ?? null;
  const ratings = useTypeRatings(open && active ? active.type : null);
  const ranked = active?.nearby ? rankProviders(active.nearby.providers, origin, ratings) : [];

  const propertyLayer = listingLayerOf(target);
  const settled = types.length > 0 && lists.every((l) => l.nearby !== null);
  const offeredCount = offered.length;
  // The denominator of the funnel: a property card that could have offered services, with how many types had somebody.
  useEffect(() => {
    if (!propertyId || !settled) return;
    trackPropertyServicesOnce({
      action: 'view',
      property_layer: propertyLayer,
      property_id: propertyId,
      types_offered: offeredCount,
    });
  }, [propertyId, propertyLayer, settled, offeredCount]);

  // Looking at a type's list (opening the section shows the first one; switching tabs shows another).
  const activeType = active?.type;
  useEffect(() => {
    if (!open || !propertyId || !activeType) return;
    trackPropertyServicesOnce({
      action: 'open',
      property_layer: propertyLayer,
      property_id: propertyId,
      service_type: activeType,
    });
  }, [open, propertyId, propertyLayer, activeType]);

  if (offered.length === 0 || !active?.nearby) return null;

  const names = offered.map((l) => t(targetLabelKey(targetFromKey(l.type)!)));
  const shown = all ? ranked.slice(0, MORE) : ranked.slice(0, TOP);
  const rest = Math.min(ranked.length, MORE) - TOP;
  const { radiusKm, viaGovernorate } = active.nearby;
  const track = (provider: RankedProvider): Tracker => ({
    contact: (channel) => {
      if (propertyId && provider.r.id)
        trackPropertyServices({
          action: 'contact',
          property_layer: propertyLayer,
          property_id: propertyId,
          service_type: active.type,
          provider_id: provider.r.id,
          channel,
        });
    },
    request: () => {
      if (propertyId && provider.r.id)
        trackPropertyServices({
          action: 'request',
          property_layer: propertyLayer,
          property_id: propertyId,
          service_type: active.type,
          provider_id: provider.r.id,
        });
    },
  });
  // Where the list came from: close by, or — when few were close — wider, or finally the property's governorate.
  const reach = viaGovernorate
    ? t('propertyServices.viaGovernorate', { km: radiusKm })
    : radiusKm > RADII_KM[0]
      ? t('propertyServices.widened', { first: RADII_KM[0], km: radiusKm })
      : t('propertyServices.within', { km: radiusKm });

  return (
    <section aria-labelledby={`${id}-title`} className={clsx('rounded-xl border border-line bg-subtle', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        className="flex w-full items-center gap-3 rounded-xl p-3 text-start focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-light text-brand-fg">
          <Handshake className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span id={`${id}-title`} className="block text-base font-bold text-fg">
            {t(`propertyServices.title.${target.kind === 'realEstate' ? target.layer : 'land'}`)}
          </span>
          {!open && <span className="block truncate text-sm text-muted">{names.join(' · ')}</span>}
        </span>
        <ChevronDown className={clsx('h-5 w-5 shrink-0 text-muted transition', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div id={`${id}-body`} className="space-y-3 border-t border-line p-3">
          <Tabs<string>
            tabs={offered.map((l) => {
              const type = targetFromKey(l.type)!;
              return {
                id: l.type,
                label: `${t(targetLabelKey(type))} (${l.nearby!.providers.length})`,
                icon: <span aria-hidden><TargetIcon target={type} /></span>,
              };
            })}
            value={active.type}
            onChange={(type) => {
              setPicked(type);
              setAll(false);
            }}
            label={t('propertyServices.tabs')}
            idPrefix={id}
            scrollable
          />
          <div role="tabpanel" id={`${id}-tabpanel-${active.type}`} aria-labelledby={`${id}-tab-${active.type}`} className="space-y-2">
            <div className="space-y-0.5 text-sm">
              <p className="font-semibold text-fg">{reach}</p>
              <p className="text-muted">{t('propertyServices.ranking')}</p>
            </div>
            <ul className="space-y-2">
              {shown.map((p) => (
                <ProviderRow key={p.r.key} p={p} track={track(p)} />
              ))}
            </ul>
            {rest > 0 && (
              <button
                type="button"
                onClick={() => setAll((v) => !v)}
                aria-expanded={all}
                className="text-sm font-semibold text-brand-fg hover:underline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {all ? t('common.showLess') : t('propertyServices.more', { count: rest })}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
