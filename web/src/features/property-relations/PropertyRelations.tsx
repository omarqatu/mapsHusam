import { useId } from 'react';
import { Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMyListings } from '@/api/myListings';
import { useCreateRelation, useMyPropertyRelations, usePropertyRelations } from '@/api/propertyRelations';
import Button from '@/components/ui/Button';
import { toast } from '@/components/ui/toastStore';
import { errorText } from '@/lib/errorText';
import { useAuthStore } from '@/store/authStore';
import TargetIcon from '../map/TargetIcon';
import { listingLayerOf, targetFromKey, type MapTarget } from '../map/targets';
import { canHaveRelations, claimsFor, myWaitingOn } from './model';

interface Props {
  /** The property this card is about. */
  target: MapTarget;
  /** The property's id (feature id). */
  propertyId: string | null;
  className?: string;
}

/**
 * "Who worked on this land": the surveyor / valuer that the land's owner AND the provider both agreed to name — shown as
 * their statement, not as the platform's guarantee. A signed-in provider with a matching listing can say "I surveyed this"
 * from here; it waits for the other side and appears once they agree. Nothing shows when there is nothing to say.
 */
export default function PropertyRelations({ target, propertyId, className }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const layer = target.kind === 'realEstate' ? listingLayerOf(target) : null;
  const relevant = !!layer && !!propertyId && canHaveRelations(layer);
  const signedIn = useAuthStore((s) => !!s.user);

  const accepted = usePropertyRelations(relevant ? layer : null, relevant ? propertyId : null);
  const listings = useMyListings(relevant && signedIn);
  const mine = useMyPropertyRelations(relevant && signedIn);
  const create = useCreateRelation();

  if (!relevant || !layer || !propertyId) return null;
  const shown = accepted.data ?? [];
  const claims = claimsFor(layer, propertyId, listings.data ?? [], mine.data ?? []);
  const waiting = myWaitingOn(layer, propertyId, mine.data ?? []);
  if (shown.length === 0 && claims.length === 0 && waiting.length === 0) return null;

  const severalListings = new Set(claims.map((c) => c.listing.id)).size > 1;
  const send = (c: (typeof claims)[number]) =>
    create.mutate(
      {
        property_layer: layer,
        property_id: propertyId,
        relation: c.relation,
        provider_layer: c.listing.layer,
        provider_id: c.listing.id,
      },
      {
        onSuccess: () => toast.success(t('propertyRelations.sent')),
        onError: (e) => toast.error(errorText(e, t('propertyRelations.failed'))),
      },
    );

  return (
    <section aria-labelledby={`${id}-title`} className={`space-y-2 rounded-xl border border-line bg-subtle p-3 ${className ?? ''}`}>
      <h3 id={`${id}-title`} className="flex items-center gap-2 text-base font-bold text-fg">
        <Link2 className="h-4 w-4 text-brand-fg" aria-hidden />
        {t('propertyRelations.title')}
      </h3>
      {shown.length > 0 && (
        <>
          <ul className="space-y-1">
            {shown.map((r) => {
              const type = targetFromKey(r.provider_layer);
              return (
                <li key={r.id} className="flex items-baseline gap-2 text-sm">
                  {type && <TargetIcon target={type} className="h-4 w-4 shrink-0 translate-y-0.5 self-start text-brand-fg" />}
                  <span className="text-muted">{t(`propertyRelations.kind.${r.relation}`)}</span>
                  <strong className="min-w-0 break-words text-fg" dir="auto">
                    {r.provider_name}
                  </strong>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">{t('propertyRelations.note')}</p>
        </>
      )}
      {waiting.map((r) => (
        <p key={r.id} className="text-sm text-muted">
          {t('propertyRelations.waiting', { kind: t(`propertyRelations.kind.${r.relation}`), name: r.provider_name })}
        </p>
      ))}
      {claims.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {claims.map((c) => (
            <Button
              key={`${c.relation}:${c.listing.id}`}
              variant="secondary"
              size="sm"
              loading={create.isPending}
              onClick={() => send(c)}
            >
              {t(`propertyRelations.claim.${c.relation}`)}
              {severalListings ? ` — ${c.listing.name}` : ''}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
