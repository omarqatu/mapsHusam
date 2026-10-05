import { useState } from 'react';
import { Check, Undo2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRespondRelation, useRevokeRelation, type MyRelation } from '@/api/propertyRelations';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toastStore';
import { errorText } from '@/lib/errorText';
import TargetIcon from '../map/TargetIcon';
import { targetFromKey } from '../map/targets';
import { statusKey } from './model';

interface Props {
  relation: MyRelation;
  /** Which name leads: the provider (on a property's page), the property (on a provider's page, and for the admin). */
  lead: 'provider' | 'property';
}

/** One relation with what this account may do with it: accept / decline when it waits for them, withdraw or end otherwise. */
export default function RelationRow({ relation: r, lead }: Props) {
  const { t } = useTranslation();
  const respond = useRespondRelation();
  const revoke = useRevokeRelation();
  const [confirming, setConfirming] = useState(false);
  const type = targetFromKey(r.provider_layer);
  const name = lead === 'provider' ? r.provider_name : r.property_name || `#${r.property_id}`;
  const other = lead === 'provider' ? r.property_name : r.provider_name;
  const failed = (e: unknown) => toast.error(errorText(e, t('propertyRelations.manager.failed')));
  const answer = (accept: boolean) => respond.mutate({ id: r.id, accept }, { onError: failed });
  const ending = r.status === 'accepted';

  return (
    <li className="space-y-2 rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-baseline gap-2 text-base font-bold text-fg">
            {type && <TargetIcon target={type} className="h-5 w-5 shrink-0 translate-y-0.5 self-start text-brand-fg" />}
            <span className="min-w-0 break-words" dir="auto">
              {name}
            </span>
          </p>
          <p className="text-sm text-muted" dir="auto">
            {t(`propertyRelations.kind.${r.relation}`)}
            {lead === 'property' && other ? ` · ${other}` : ''}
          </p>
        </div>
        <Badge tone={r.status === 'accepted' ? 'green' : 'amber'} large>
          {t(`propertyRelations.manager.status.${statusKey(r)}`)}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {r.can_answer && (
          <>
            <Button size="sm" startIcon={<Check className="h-4 w-4" aria-hidden />} loading={respond.isPending} onClick={() => answer(true)}>
              {t('propertyRelations.manager.accept')}
            </Button>
            <Button size="sm" variant="secondary" startIcon={<X className="h-4 w-4" aria-hidden />} disabled={respond.isPending} onClick={() => answer(false)}>
              {t('propertyRelations.manager.decline')}
            </Button>
          </>
        )}
        {!r.can_answer && r.can_revoke && (
          <Button size="sm" variant="secondary" startIcon={<Undo2 className="h-4 w-4" aria-hidden />} onClick={() => (ending ? setConfirming(true) : revoke.mutate(r.id, { onError: failed }))}>
            {t(ending ? 'propertyRelations.manager.end' : 'propertyRelations.manager.withdraw')}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        title={t('propertyRelations.manager.endTitle')}
        message={t('propertyRelations.manager.endMessage', { name })}
        confirmLabel={t('propertyRelations.manager.end')}
        tone="danger"
        loading={revoke.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => revoke.mutate(r.id, { onSuccess: () => setConfirming(false), onError: failed })}
      />
    </li>
  );
}
