import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MyListing } from '@/api/myListings';
import {
  useCreateRelation,
  useMyPropertyRelations,
  type MyRelation,
  type RelationKind,
} from '@/api/propertyRelations';
import Button from '@/components/ui/Button';
import { CenteredSpinner } from '@/components/ui/Spinner';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import { errorText } from '@/lib/errorText';
import { text } from '../map/popup/featureModel';
import { isLive, RELATION_KINDS, RELATIONS } from './model';
import { useProvidersOfType } from './queries';
import RelationRow from './RelationRow';

const MAX_RESULTS = 6;

/** The owner picks a surveyor or valuer by name and asks to name them on the property; their consent is still needed. */
function AddRelation({ listing }: { listing: MyListing }) {
  const { t } = useTranslation();
  const create = useCreateRelation();
  const kinds = RELATION_KINDS.filter((k) => RELATIONS[k].properties.includes(listing.layer));
  const [kind, setKind] = useState<RelationKind>(kinds[0]);
  const [q, setQ] = useState('');
  const providers = useProvidersOfType(RELATIONS[kind].providerLayer, true);
  const needle = q.trim().toLowerCase();
  const matches = (providers.data ?? [])
    .filter((r) => !needle || text(r.props.name).toLowerCase().includes(needle))
    .slice(0, MAX_RESULTS);

  const ask = (provider: { id: string; name: string }) =>
    create.mutate(
      {
        property_layer: listing.layer,
        property_id: listing.id,
        relation: kind,
        provider_layer: RELATIONS[kind].providerLayer,
        provider_id: provider.id,
      },
      {
        onSuccess: () => {
          toast.success(t('propertyRelations.manager.sent', { name: provider.name }));
          setQ('');
        },
        onError: (e) => toast.error(errorText(e, t('propertyRelations.manager.failed'))),
      },
    );

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-line-strong p-3">
      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('propertyRelations.manager.kind')}>
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                kind === k ? 'border-brand bg-brand-light text-brand-fg' : 'border-line text-fg'
              }`}
            >
              {t(`propertyRelations.manager.add.${k}`)}
            </button>
          ))}
        </div>
      )}
      <TextInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('propertyRelations.manager.search')}
        aria-label={t('propertyRelations.manager.search')}
      />
      {providers.isPending && <CenteredSpinner minHeight="3rem" size="sm" />}
      {providers.data && matches.length === 0 && (
        <p className="text-sm text-muted">{t('propertyRelations.manager.noMatch')}</p>
      )}
      <ul className="space-y-1.5">
        {matches.map((r) => {
          const name = text(r.props.name);
          return (
            <li key={r.key} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
              <span className="min-w-0 text-sm">
                <strong className="break-words" dir="auto">
                  {name}
                </strong>
                <span className="text-muted" dir="auto">
                  {' · '}
                  {text(r.props.village_a) || text(r.props.gov_a)}
                </span>
              </span>
              <Button size="sm" variant="secondary" disabled={create.isPending || !r.id} onClick={() => r.id && ask({ id: r.id, name })}>
                {t('propertyRelations.manager.ask')}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * A listing's relations: for a property, who the owner named (and asked to name) as its surveyor / valuer; for a provider,
 * the properties that named it. Accepting, declining, withdrawing and ending are saved at once. Revoked ones are not listed.
 */
export default function RelationsManager({ listing }: { listing: MyListing }) {
  const { t } = useTranslation();
  const mine = useMyPropertyRelations();
  const [adding, setAdding] = useState(false);
  const isProperty = listing.kind === 'property';
  const rows: MyRelation[] = (mine.data ?? []).filter(
    (r) =>
      isLive(r) &&
      (isProperty
        ? r.property_layer === listing.layer && r.property_id === listing.id
        : r.provider_layer === listing.layer && r.provider_id === listing.id),
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t(isProperty ? 'propertyRelations.manager.hintProperty' : 'propertyRelations.manager.hintProvider')}</p>
      {mine.isPending && <CenteredSpinner minHeight="3rem" size="sm" />}
      {mine.data && rows.length === 0 && <p className="text-sm text-muted">{t('propertyRelations.manager.empty')}</p>}
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <RelationRow key={r.id} relation={r} lead={isProperty ? 'provider' : 'property'} />
          ))}
        </ul>
      )}
      {isProperty &&
        (adding ? (
          <AddRelation listing={listing} />
        ) : (
          <Button variant="secondary" size="sm" startIcon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setAdding(true)}>
            {t('propertyRelations.manager.addButton')}
          </Button>
        ))}
    </div>
  );
}
