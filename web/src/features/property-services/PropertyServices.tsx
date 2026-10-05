import { useId, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Handshake, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import RatingSummary from '@/components/ui/RatingSummary';
import Tabs from '@/components/ui/Tabs';
import i18n from '@/i18n';
import { useLayerFilter } from '../visibility/store';
import type { Coordinate } from '../map/config';
import { useShowOnMap } from '../map/extras/useShowOnMap';
import { AvailabilityText } from '../map/popup/AvailabilityText';
import { availability, text, type Props } from '../map/popup/featureModel';
import { formatDistance } from '../map/search/nearby';
import ResultContact from '../map/search/ResultContact';
import { targetFromKey, targetIcon, targetLabelKey, type MapTarget } from '../map/targets';
import { servicesFor } from './model';
import { logPropertyServices, usePropertyServicesConfig, useTypeProviders, useTypeRatings } from './queries';
import { rankProviders, type RankedProvider } from './rank';

/** Providers shown at first, and after "show more". A card is not a directory: three answers, then a way to see more. */
const TOP = 3;
const MORE = 10;

const arLabel = (target: MapTarget) => i18n.getFixedT('ar')(targetLabelKey(target));

function ProviderRow({ p, serviceTitle }: { p: RankedProvider; serviceTitle: string }) {
  const { t } = useTranslation();
  const showOnMap = useShowOnMap();
  const props = p.r.props;
  const state = availability(props);
  const place = text(props.village_a) || text(props.gov_a);
  return (
    <li className="space-y-1.5 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 break-words text-base font-bold text-fg" dir="auto">
          {text(props.name) || t('popup.provider')}
        </h4>
        {state && <AvailabilityText value={state} className="shrink-0 text-sm font-semibold" />}
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
        <ResultContact
          r={p.r}
          showRequest
          className="contents"
          onContact={() => logPropertyServices('property_services_contact', serviceTitle)}
        />
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
  /** A point on the property: distances are measured from here, not from the visitor. */
  origin: Coordinate;
  /** The property's data (its governorate decides "in the area"). */
  props: Props;
  className?: string;
}

/**
 * "Services for this land": the kinds of provider a property buyer reaches for next (a surveyor, a valuer, a lawyer),
 * each with who is best placed to help with THIS property — in its governorate, available now, well rated, then nearest.
 * Collapsed to one line until asked; a type nobody offers yet is left out, and nothing shows when no type has anyone.
 */
export default function PropertyServices({ target, origin, props, className }: Props_) {
  const { t } = useTranslation();
  const id = useId();
  const config = usePropertyServicesConfig();
  const shownToViewer = useLayerFilter();
  const types = useMemo(
    () => (config ? servicesFor(config, target).filter((type) => shownToViewer(type)) : []),
    [config, target, shownToViewer],
  );
  const lists = useTypeProviders(types);

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  // Types with someone to offer, in the configured order.
  const offered = lists.filter((l) => l.providers && l.providers.length > 0);
  const active = offered.find((l) => l.type === picked) ?? offered[0] ?? null;
  const ratings = useTypeRatings(open && active ? active.type : null);
  const gov = text(props.gov_a);
  // A type is a list of tens, so ranking it on every render is cheap (the compiler memoizes it anyway).
  const ranked = active?.providers ? rankProviders(active.providers, origin, { gov }, ratings) : [];

  if (offered.length === 0 || !active) return null;

  const names = offered.map((l) => t(targetLabelKey(targetFromKey(l.type)!)));
  const shown = all ? ranked.slice(0, MORE) : ranked.slice(0, TOP);
  const rest = Math.min(ranked.length, MORE) - TOP;
  const nobodyInArea = !!gov && ranked.length > 0 && !ranked[0].inArea;
  const activeTarget = targetFromKey(active.type)!;

  const toggle = () => {
    // Opening is recorded against the property kind it was opened on; a contact against the type that was contacted.
    if (!open) logPropertyServices('property_services_open', arLabel(target));
    setOpen((v) => !v);
  };

  return (
    <section aria-labelledby={`${id}-title`} className={clsx('rounded-xl border border-line bg-subtle', className)}>
      <button
        type="button"
        onClick={toggle}
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
                label: `${t(targetLabelKey(type))} (${l.providers!.length})`,
                icon: <span aria-hidden>{targetIcon(type)}</span>,
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
            <p className="text-sm text-muted">
              {nobodyInArea ? t('propertyServices.noneInArea') : t('propertyServices.ranking')}
            </p>
            <ul className="space-y-2">
              {shown.map((p) => (
                <ProviderRow key={p.r.key} p={p} serviceTitle={arLabel(activeTarget)} />
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
