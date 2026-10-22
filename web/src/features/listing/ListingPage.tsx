import clsx from 'clsx';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronLeft,
  FileText,
  Info,
  Link2,
  MapPin,
  SearchX,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { searchApi } from '@/api/search';
import ActionTile, { ActionTiles } from '@/components/ui/ActionTile';
import ButtonLink from '@/components/ui/ButtonLink';
import EmptyState from '@/components/ui/EmptyState';
import MediaGallery, { type VisualItem } from '@/components/ui/MediaGallery';
import RatingSummary from '@/components/ui/RatingSummary';
import { CenteredSpinner } from '@/components/ui/Spinner';
import TargetIcon from '../map/TargetIcon';
import { customerRatingsKey, manualStars } from '../map/extras/featured';
import { useShowOnMap } from '../map/extras/useShowOnMap';
import { AvailabilityText } from '../map/popup/AvailabilityText';
import DirectionsButton from '../map/popup/DirectionsButton';
import { BeforeAfterPair } from '../map/popup/MediaShowcase';
import RatingsBlock from '../map/popup/RatingsBlock';
import {
  availability,
  beforeAfterPair,
  collectMedia,
  hoursLabel,
  labelMedia,
  listingTitle,
  priceLabel,
  text,
} from '../map/popup/featureModel';
import { toResults, type SearchResult } from '../map/search/results';
import ResultContact from '../map/search/ResultContact';
import {
  hasPrice,
  isRoadBarrier,
  priceCurrencyDefault,
  targetFromKey,
  targetKey,
  targetLabelKey,
  targetToApi,
} from '../map/targets';
import PropertyRelations from '../property-relations/PropertyRelations';
import PropertyServices from '../property-services/PropertyServices';
import ListingFacts from './ListingFacts';
import ListingGallery from './ListingGallery';
import { listingDate, postedAgo } from './model';
import SaveListingButton from './SaveListingButton';
import ShareListingButton from './ShareListingButton';
import SimilarListings from './SimilarListings';
import { listingUrl } from './link';

const SOURCE = 'quick_search' as const;

/** The full description: kept whole on this page, clamped only when very long. */
function Description({ value }: { value: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const long = value.length > 600;
  return (
    <div>
      <p
        className={
          open || !long
            ? 'whitespace-pre-line text-base leading-7 text-fg'
            : 'line-clamp-6 whitespace-pre-line text-base leading-7 text-fg'
        }
        dir="auto"
      >
        {value}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1 text-sm font-semibold text-brand-fg hover:underline"
        >
          {open ? t('common.showLess') : t('common.showMore')}
        </button>
      )}
    </div>
  );
}

/** A titled card of the page; the icon makes each part easy to find while scrolling. */
function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5"
    >
      <h2 id={id} className="flex items-center gap-2 border-b border-line pb-3 text-lg font-black text-fg">
        <span className="text-brand-fg [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const SAFETY_TIPS = ['see', 'noAdvance', 'papers'] as const;

/** Before dealing with a stranger: what the marketplace sites remind of next to every listing. */
function SafetyTips({ className }: { className?: string }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={clsx('space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm', className)}
    >
      <h2 id={id} className="flex items-center gap-2 font-bold text-fg">
        <ShieldCheck className="h-5 w-5 text-ok" aria-hidden /> {t('listing.page.safety.title')}
      </h2>
      <ul className="list-disc space-y-1 ps-5 text-muted">
        {SAFETY_TIPS.map((k) => (
          <li key={k}>{t(`listing.page.safety.${k}`)}</li>
        ))}
      </ul>
    </section>
  );
}

/** A listing, as its own page: gallery, the key facts beside it (sticky on desktop), details under it. */
function ListingView({ r }: { r: SearchResult }) {
  const { t, i18n } = useTranslation();
  const showOnMap = useShowOnMap();
  const p = r.props;
  const title = listingTitle(r.target, p, t);
  const typeTitle = t(targetLabelKey(r.target));
  const media = labelMedia(collectMedia(p), t);
  const visual = media.filter((m): m is VisualItem => m.type !== 'link');
  const links = media.filter((m) => m.type === 'link');
  const pair = beforeAfterPair(p);
  const place = [text(p.location_name) || text(p.location), text(p.village_a), text(p.gov_a)]
    .filter(Boolean)
    .join(' · ');
  const priced = hasPrice(r.target);
  const price = priced ? priceLabel(p, t, i18n.language, priceCurrencyDefault(r.target)) : null;
  const posted = listingDate(p.start_date);
  const state = isRoadBarrier(r.target) ? null : availability(p);
  const hours = r.target.kind === 'service' ? hoursLabel(p.work_hours, t, i18n.language) : '';
  const ratingsKey = customerRatingsKey(r);
  const stars = manualStars(r.rating);

  const actions = (
    <ActionTiles>
      <ActionTile icon={<MapPin />} label={t('extras.featured.onMap')} onClick={() => showOnMap(r)} />
      {!isRoadBarrier(r.target) && <DirectionsButton coordinate={r.center} tile />}
      {r.id !== null && (
        <>
          <SaveListingButton target={r.target} id={r.id} />
          <ShareListingButton title={title} url={listingUrl(r.target, r.id)} tile />
        </>
      )}
    </ActionTiles>
  );

  return (
    <article className="mx-auto w-full max-w-6xl space-y-4">
      <nav aria-label={t('listing.page.breadcrumb')} className="flex items-center gap-1 text-sm text-muted">
        <Link to="/search" className="font-semibold text-brand-fg hover:underline">
          {t('nav.search')}
        </Link>
        <ChevronLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
        <Link
          to={`/search?type=${encodeURIComponent(targetKey(r.target))}`}
          className="hover:text-brand-fg hover:underline"
        >
          {typeTitle}
        </Link>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
        <div className="min-w-0">
          <ListingGallery
            items={visual}
            empty={
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-surface text-5xl text-brand-fg shadow-float">
                <TargetIcon target={r.target} />
              </span>
            }
          />
        </div>

        {/* The summary: under the pictures on phones, beside them (and sticky) on desktop. */}
        <aside className="lg:row-span-2">
          <div className="space-y-3 lg:sticky lg:top-20">
            <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-warn">
                <TargetIcon target={r.target} className="h-4 w-4" />
                <span>{typeTitle}</span>
                {r.id && <span className="font-normal text-muted">#{r.id}</span>}
              </div>
              <h1 className="text-2xl font-black leading-snug text-fg" dir="auto">
                {title}
              </h1>
              {price && <p className="text-3xl font-black text-brand-fg">{price}</p>}
              {place && (
                <p className="flex items-start gap-1.5 text-sm text-muted" dir="auto">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {place}
                </p>
              )}
              {posted && (
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                  {t('listing.page.postedAgo', { when: postedAgo(posted, i18n.language) })}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {!ratingsKey && stars > 0 && <RatingSummary value={stars} />}
                {state && <AvailabilityText value={state} suffix={hours} />}
              </div>
              <div className="max-lg:hidden">
                <ResultContact r={r} showRequest wide className="w-full" source={SOURCE} />
              </div>
              {actions}
            </div>
            <SafetyTips className="max-lg:hidden" />
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <Section title={t('listing.page.details')} icon={<Info />}>
            <ListingFacts r={r} visual={visual} />
          </Section>

          {text(p.des) && (
            <Section title={t('listing.page.description')} icon={<FileText />}>
              <Description value={text(p.des)} />
            </Section>
          )}

          {pair && (
            <Section title={t('media.beforeAfter')} icon={<ArrowLeftRight />}>
              <BeforeAfterPair {...pair} />
            </Section>
          )}

          {links.length > 0 && (
            <Section title={t('listing.page.links')} icon={<Link2 />}>
              <MediaGallery items={links} />
            </Section>
          )}

          {ratingsKey && (
            <Section title={t('listing.page.ratings')} icon={<Star />}>
              <RatingsBlock layer={ratingsKey.layer} featureId={ratingsKey.featureId} />
            </Section>
          )}

          <PropertyRelations target={r.target} propertyId={r.id} />
          <PropertyServices
            target={r.target}
            propertyId={r.id}
            origin={r.center}
            props={p}
            contactSource={SOURCE}
          />
          <SafetyTips className="lg:hidden" />
        </div>
      </div>

      <SimilarListings of={r} />

      {/* Phones: contact stays at hand while scrolling, and stops before the footer. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <ResultContact r={r} showRequest wide className="w-full" source={SOURCE} />
      </div>
    </article>
  );
}

/**
 * One listing's own page (`/l/<type>/<id>`): what a shared link opens. Public — the server applies the same rules as the
 * search (hidden types, withdrawn / expired listings, visitor contact), so a link never shows more than the search does.
 */
export default function ListingPage() {
  const { t } = useTranslation();
  const { key, id } = useParams();
  const target = targetFromKey(key);
  const { data, isPending, isError } = useQuery({
    queryKey: ['listing-page', key, id],
    queryFn: ({ signal }) => searchApi.batch({ ...targetToApi(target!), ids: [id!] }, signal),
    enabled: !!target && !!id,
    select: (fc) => toResults(fc, target)[0] ?? null,
  });
  const title = data ? listingTitle(data.target, data.props, t) : null;
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    document.title = `${title} · ${t('app.name')}`;
    return () => {
      document.title = before;
    };
  }, [title, t]);

  if (target && id && isPending) return <CenteredSpinner />;
  if (!data)
    return (
      <EmptyState
        icon={<SearchX className="h-10 w-10" aria-hidden />}
        title={t(isError ? 'listing.loadFailed' : 'listing.notFound')}
        description={t('listing.notFoundHint')}
        action={<ButtonLink to="/search">{t('listing.browse')}</ButtonLink>}
      />
    );
  return <ListingView r={data} />;
}
