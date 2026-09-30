import { useState } from 'react';
import { Link } from 'react-router';
import {
  Bus,
  CalendarDays,
  CircleDollarSign,
  CloudSun,
  Fuel,
  Gem,
  LayoutDashboard,
  Milestone,
  Route,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStatusUpdatedAt } from '@/api/liveStatus';
import { WIDGET_GROUPS, type WidgetGroupKey } from '@/api/adminWidgets';
import AlertMessage from '@/components/ui/AlertMessage';
import { CenteredSpinner } from '@/components/ui/Spinner';
import PageHeader from '@/components/ui/PageHeader';
import Tabs, { type TabDef } from '@/components/ui/Tabs';
import { errorText } from '@/lib/errorText';
import GroupPanel from './components/GroupPanel';
import StatusPanel from './components/StatusPanel';
import { useFeatures, useWidgetGroups } from './hooks/useAdminWidgets';

type TabId = WidgetGroupKey | 'road' | 'fuelStations';

const icons: Record<TabId, typeof Zap> = {
  currency: CircleDollarSign,
  gold: Gem,
  weather: CloudSun,
  fuel: Fuel,
  transport_inter_city: Bus,
  transport_intra_city: Milestone,
  events: CalendarDays,
  road: Route,
  fuelStations: Fuel,
};
const TAB_IDS: TabId[] = [...WIDGET_GROUPS, 'road', 'fuelStations'];

/** `/admin/widgets` — the live-information centre: seven hand-edited groups + road-checkpoint and fuel-station status (legacy widgets-admin.html). */
export default function AdminWidgetsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>('currency');
  const groups = useWidgetGroups();
  const features = useFeatures();
  const roadStamp = useStatusUpdatedAt('road_barriers');
  const fuelStamp = useStatusUpdatedAt('fuel_stations');

  const tabs: TabDef<TabId>[] = TAB_IDS.map((id) => {
    const Icon = icons[id];
    return { id, label: t(`adminWidgets.tab.${id}`), icon: <Icon className="h-4 w-4" aria-hidden /> };
  });

  const loading = groups.isLoading || features.isLoading;
  const error = groups.error ?? features.error;

  return (
    <>
      <PageHeader
        title={t('adminWidgets.title')}
        description={t('adminWidgets.subtitle')}
        icon={<Zap className="h-6 w-6" aria-hidden />}
        actions={
          <Link
            to="/admin/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 font-semibold text-fg hover:bg-subtle"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            {t('nav.adminDashboard')}
          </Link>
        }
      />
      <div className="rounded-2xl border border-line bg-surface shadow-sm">
        <Tabs
          scrollable
          className="m-3"
          label={t('adminWidgets.title')}
          idPrefix="widgets"
          value={tab}
          onChange={setTab}
          tabs={tabs}
        />
        <div className="p-4 pt-1">
          {loading ? (
            <CenteredSpinner />
          ) : error ? (
            <AlertMessage type="error" message={errorText(error, t('adminWidgets.loadFailed'))} />
          ) : (
            // Every panel stays mounted (hidden when not shown) so unsaved edits survive switching tabs.
            TAB_IDS.map((id) => (
              <div
                key={id}
                role="tabpanel"
                id={`widgets-tabpanel-${id}`}
                aria-labelledby={`widgets-tab-${id}`}
                hidden={tab !== id}
              >
                {id === 'road' ? (
                  <StatusPanel
                    kind="road"
                    rows={features.data?.roadBarriers ?? []}
                    stamp={roadStamp.data}
                    onReload={() => features.refetch()}
                  />
                ) : id === 'fuelStations' ? (
                  <StatusPanel
                    kind="fuel"
                    rows={features.data?.fuelStations ?? []}
                    stamp={fuelStamp.data}
                    onReload={() => features.refetch()}
                  />
                ) : (
                  <>
                    {(id === 'currency' || id === 'gold' || id === 'fuel') && (
                      <AlertMessage
                        type="info"
                        message={t(id === 'fuel' ? 'adminWidgets.liveNoteFuel' : 'adminWidgets.liveNote')}
                        className="mb-3"
                      />
                    )}
                    <GroupPanel
                      groupKey={id}
                      items={groups.data?.[id]?.items ?? []}
                      updatedAt={groups.data?.[id]?.updatedAt ?? null}
                      onReload={() => groups.refetch()}
                    />
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
