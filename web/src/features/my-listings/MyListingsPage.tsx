import { useState } from 'react';
import { Building2, ImageIcon, MapPin, Pencil, Plus, Store, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMySubmissions } from '@/api/listingSubmissions';
import {
  useEditListing,
  useMyListings,
  type ListingKind,
  type ListingState,
  type MyListing,
} from '@/api/myListings';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import RatingSummary from '@/components/ui/RatingSummary';
import { CenteredSpinner } from '@/components/ui/Spinner';
import Tabs, { type TabDef } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/toastStore';
import { mapLinkTo } from '@/features/map/mapLink';
import { safeMediaUrl } from '@/features/map/popup/featureModel';
import { targetLabelKey } from '@/features/map/targets';
import { errorText } from '@/lib/errorText';
import ListingEditor from './ListingEditor';
import { listingTarget } from './model';
import StatePicker from './StatePicker';
import TargetIcon from '@/features/map/TargetIcon';

type Tab = 'services' | 'properties';
const KIND: Record<Tab, ListingKind> = { services: 'service', properties: 'property' };

/**
 * `/my-listings` — the account's own services and properties in two tabs: state at a glance (and one tap to change
 * it), pictures, the edit sheet, the map. New listings go through "add a listing" (the admins approve them).
 */
export default function MyListingsPage() {
  const { t } = useTranslation();
  const listings = useMyListings();
  const submissions = useMySubmissions();
  const [chosen, setChosen] = useState<Tab | null>(null);
  const [editing, setEditing] = useState<{ layer: string; id: number } | null>(null);

  const header = (
    <PageHeader
      title={t('myListings.title')}
      description={t('myListings.subtitle')}
      icon={<Store className="h-6 w-6" aria-hidden />}
      actions={
        <ButtonLink to="/add-listing" startIcon={<Plus className="h-4 w-4" aria-hidden />}>
          {t('myListings.add')}
        </ButtonLink>
      }
    />
  );
  if (listings.isPending) return <CenteredSpinner />;
  if (listings.isError)
    return (
      <>
        {header}
        <AlertMessage type="error" message={errorText(listings.error, t('myListings.loadFailed'))} />
      </>
    );

  const all = listings.data;
  const of = (tab: Tab) => all.filter((l) => l.kind === KIND[tab]);
  // Open on the tab that has something (a property owner should not land on an empty "services").
  const tab: Tab =
    chosen ?? (of('services').length === 0 && of('properties').length > 0 ? 'properties' : 'services');
  const tabs: TabDef<Tab>[] = (['services', 'properties'] as const).map((id) => ({
    id,
    label: `${t(`myListings.tabs.${id}`)} (${of(id).length})`,
    icon:
      id === 'services' ? (
        <Wrench className="h-4 w-4" aria-hidden />
      ) : (
        <Building2 className="h-4 w-4" aria-hidden />
      ),
  }));
  const shown = of(tab);
  const latest = submissions.data?.[0];
  const open = editing ? all.find((l) => l.layer === editing.layer && l.id === editing.id) : undefined;

  return (
    <>
      {header}
      <div className="space-y-4">
        {latest?.status === 'pending' && (
          <AlertMessage type="info" message={t('myListings.pending', { name: latest.name })} />
        )}
        {latest?.status === 'rejected' && (
          <AlertMessage
            type="warning"
            message={t('myListings.rejected', { name: latest.name, reason: latest.reject_reason ?? '' })}
          />
        )}
        <Tabs
          tabs={tabs}
          value={tab}
          onChange={setChosen}
          label={t('myListings.title')}
          idPrefix="my-listings"
        />
        <div role="tabpanel" id={`my-listings-tabpanel-${tab}`} aria-labelledby={`my-listings-tab-${tab}`}>
          {shown.length === 0 ? (
            <EmptyState
              icon={
                tab === 'services' ? (
                  <Wrench className="h-8 w-8" aria-hidden />
                ) : (
                  <Building2 className="h-8 w-8" aria-hidden />
                )
              }
              title={t(`myListings.empty.${tab}`)}
              description={t('myListings.empty.hint')}
              action={
                <ButtonLink to="/add-listing" startIcon={<Plus className="h-4 w-4" aria-hidden />}>
                  {t('myListings.add')}
                </ButtonLink>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((l) => (
                <li key={`${l.layer}:${l.id}`}>
                  <ListingCard listing={l} onEdit={() => setEditing({ layer: l.layer, id: l.id })} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {open && <ListingEditor listing={open} onClose={() => setEditing(null)} />}
    </>
  );
}

function ListingCard({ listing: l, onEdit }: { listing: MyListing; onEdit: () => void }) {
  const { t } = useTranslation();
  const edit = useEditListing();
  const target = listingTarget(l.layer);
  const cover = l.photos.map(safeMediaUrl).find((u): u is string => !!u);
  const [coverFailed, setCoverFailed] = useState(false);

  const setState = (status: ListingState) =>
    edit.mutate(
      { listing: l, body: { status } },
      {
        onSuccess: () => toast.success(t('myListings.state.saved')),
        onError: (e) => toast.error(errorText(e, t('myListings.state.failed'))),
      },
    );

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <button
        type="button"
        onClick={onEdit}
        className="relative block aspect-[16/9] bg-brand-light"
        aria-label={t('myListings.edit')}
      >
        {cover && !coverFailed ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${l.status === 2 ? 'opacity-50 grayscale' : ''}`}
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1 text-brand-fg">
            <TargetIcon target={target} className="h-9 w-9" />
            <span className="text-xs font-semibold">{t('myListings.noPhoto')}</span>
          </span>
        )}
        {l.photos.length > 0 && (
          <span className="absolute bottom-2 end-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">
            <ImageIcon className="h-3.5 w-3.5" aria-hidden />
            {l.photos.length}
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            {target && <span aria-hidden><TargetIcon target={target} /></span>}
            {target ? t(targetLabelKey(target)) : l.layer}
            <span aria-hidden>·</span>
            <span dir="ltr">#{l.id}</span>
          </p>
          <h3 className="mt-0.5 truncate text-lg font-bold text-fg">{l.name}</h3>
          {l.location && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {l.location}
            </p>
          )}
          <p className="mt-1 text-sm">
            {l.rating_count > 0 && l.rating_avg !== null ? (
              <RatingSummary value={l.rating_avg} count={l.rating_count} />
            ) : (
              <span className="text-muted">{t('myListings.noRatings')}</span>
            )}
          </p>
        </div>
        <StatePicker
          name={`state-${l.layer}-${l.id}`}
          value={l.status}
          kind={l.kind}
          disabled={edit.isPending}
          onChange={setState}
        />
        <div className="mt-auto flex gap-2">
          <Button className="flex-1" startIcon={<Pencil className="h-4 w-4" aria-hidden />} onClick={onEdit}>
            {t('myListings.edit')}
          </Button>
          {l.x !== null && l.y !== null && (
            <ButtonLink
              to={mapLinkTo([l.x, l.y])}
              variant="secondary"
              className="flex-1"
              startIcon={<MapPin className="h-4 w-4" aria-hidden />}
            >
              {t('myListings.showOnMap')}
            </ButtonLink>
          )}
        </div>
      </div>
    </article>
  );
}
