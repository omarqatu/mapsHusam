import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMyPropertyRelations, type RelationStatus } from '@/api/propertyRelations';
import AlertMessage from '@/components/ui/AlertMessage';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { CenteredSpinner } from '@/components/ui/Spinner';
import Tabs, { type TabDef } from '@/components/ui/Tabs';
import { errorText } from '@/lib/errorText';
import RelationRow from './RelationRow';

const STATUSES: RelationStatus[] = ['pending', 'accepted', 'revoked'];

/**
 * `/admin/relations` — who worked on which property. The admin answers for the property side of a plot nobody owns (a
 * provider's claim waits here), and may end any relation. A provider's consent is never the admin's to give.
 */
export default function AdminRelationsPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<RelationStatus>('pending');
  const list = useMyPropertyRelations();
  const tabs: TabDef<RelationStatus>[] = STATUSES.map((id) => ({
    id,
    label: `${t(`propertyRelations.admin.status.${id}`)} (${list.data?.filter((r) => r.status === id).length ?? 0})`,
  }));
  const shown = (list.data ?? []).filter((r) => r.status === status);

  return (
    <>
      <PageHeader
        title={t('propertyRelations.admin.title')}
        description={t('propertyRelations.admin.subtitle')}
        icon={<Link2 className="h-6 w-6" aria-hidden />}
      />
      <Tabs
        tabs={tabs}
        value={status}
        onChange={setStatus}
        label={t('propertyRelations.admin.title')}
        idPrefix="relations"
        className="mb-4 max-w-lg"
      />
      <div role="tabpanel" id={`relations-tabpanel-${status}`} aria-labelledby={`relations-tab-${status}`}>
        {list.isPending && <CenteredSpinner />}
        {list.isError && <AlertMessage type="error" message={errorText(list.error, t('propertyRelations.manager.failed'))} />}
        {list.data && shown.length === 0 && <EmptyState title={t('propertyRelations.admin.empty')} />}
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((r) => (
            <RelationRow key={r.id} relation={r} lead="property" />
          ))}
        </ul>
      </div>
    </>
  );
}
