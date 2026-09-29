import { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Layers, ListChecks, RefreshCw, Save, SaveAll } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  adminWidgetsApi,
  type FuelEdit,
  type FuelStationRow,
  type RoadBarrierRow,
  type RoadEdit,
  type RoadFuelFeatures,
} from '@/api/adminWidgets';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataTable, { type Column } from '@/components/ui/DataTable';
import SelectInput from '@/components/ui/SelectInput';
import StatusDot from '@/components/ui/StatusDot';
import { toast } from '@/components/ui/toastStore';
import { roadBarrierStatus } from '@/features/map/config';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { errorText } from '@/lib/errorText';
import { adminWidgetKeys, useRefreshStamps } from '../hooks/useAdminWidgets';
import {
  collectBatch,
  dirtyIds,
  effective,
  FUEL_CONFIG,
  FUEL_OPTIONS,
  moveById,
  ROAD_CONFIG,
  ROAD_OPTIONS,
  setEdit,
  withoutEdits,
  type Edits,
} from '../model';
import LastUpdated from './LastUpdated';

export type StatusKind = 'road' | 'fuel';

type Row = RoadBarrierRow | FuelStationRow;

interface Props {
  kind: StatusKind;
  rows: Row[];
  /** Latest `updated_at` over the layer's features (public `/api/widgets-data`). */
  stamp: string | null | undefined;
  onReload: () => Promise<unknown>;
}

const CONFIG = { road: ROAD_CONFIG, fuel: FUEL_CONFIG } as const;

/**
 * Road checkpoints (in / out direction) or fuel stations (diesel / 95 / 98): a select per status field, edits kept
 * on top of the saved values, single-row save, save-all (one transaction), bulk apply to the ticked rows, manual order.
 */
export default function StatusPanel({ kind, rows, stamp, onReload }: Props) {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  const qc = useQueryClient();
  const refreshStamps = useRefreshStamps();
  const cfg = CONFIG[kind];
  const fields = cfg.fields;
  const optionKeys = kind === 'road' ? ROAD_OPTIONS : FUEL_OPTIONS;
  const optionLabel = (key: string) => (kind === 'road' ? t(`roadStatus.${key}`) : t(`popup.fuel.${key}`));
  const fieldLabel = (f: string) => t(kind === 'road' ? `adminWidgets.road.${f}` : `popup.fuel.${f}`);
  const options = optionKeys.map((o) => ({ value: o.value, label: optionLabel(o.key) }));

  const [edits, setEdits] = useState<Edits>({});
  const [order, setOrder] = useState<number[] | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [bulk, setBulk] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<'bulk' | 'reload' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const ids = useMemo(() => {
    const server = rows.map((r) => r.id);
    if (!order) return server;
    const known = order.filter((id) => byId.has(id));
    return [...known, ...server.filter((id) => !known.includes(id))];
  }, [rows, order, byId]);
  const ordered = useMemo(() => ids.map((id) => byId.get(id)!), [ids, byId]);
  const orderChanged = !!order && ids.some((id, i) => id !== rows[i]?.id);
  const dirtyCount = dirtyIds(edits).length;
  const selectedCount = ordered.filter((r) => selected.has(r.id)).length;

  const fail = (e: unknown, fallback: string) => toast.error(errorText(e, fallback));

  /** The saved values changed on the server: patch the cached rows so the table needs no reload. */
  const patch = useCallback(
    (rowIds: readonly number[], values: Record<string, string>) => {
      qc.setQueryData<RoadFuelFeatures>(adminWidgetKeys.features, (old) => {
        if (!old) return old;
        const apply = <T extends { id: number }>(list: T[]) =>
          list.map((r) =>
            rowIds.includes(r.id)
              ? { ...r, ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) }
              : r,
          );
        return kind === 'road'
          ? { ...old, roadBarriers: apply(old.roadBarriers) }
          : { ...old, fuelStations: apply(old.fuelStations) };
      });
    },
    [qc, kind],
  );

  const choose = (row: Row, field: string, value: string) =>
    setEdits((e) => setEdit(e, row.id, field, value, row));
  const toggle = useCallback((id: number, on: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);

  const saveRow = async (row: Row) => {
    const values = Object.fromEntries(fields.map((f) => [f, effective(edits, row.id, f, row)]));
    setBusy(`row-${row.id}`);
    try {
      if (kind === 'road') {
        const body: RoadEdit = {};
        if (values.stop) body.stop = values.stop;
        if (values.stop2) body.stop2 = values.stop2;
        if (!body.stop && !body.stop2) {
          toast.warning(t('adminWidgets.status.chooseFirst'));
          return;
        }
        await adminWidgetsApi.updateRoad(row.id, body);
        patch([row.id], body as Record<string, string>);
      } else {
        await adminWidgetsApi.updateFuel(row.id, {
          diesel: values.diesel === '' ? null : Number(values.diesel),
          banzen95: values.banzen95 === '' ? null : Number(values.banzen95),
          banzen98: values.banzen98 === '' ? null : Number(values.banzen98),
        });
        patch([row.id], Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')));
      }
      setEdits((e) => withoutEdits(e, [row.id], fields));
      toast.success(t(kind === 'road' ? 'adminWidgets.status.roadSaved' : 'adminWidgets.status.fuelSaved'));
      refreshStamps();
    } catch (e) {
      fail(e, t('adminWidgets.status.saveFailed'));
    } finally {
      setBusy(null);
    }
  };

  const saveAll = async () => {
    const items = collectBatch(edits);
    if (!items.length) {
      toast.info(t('adminWidgets.status.nothingToSave'));
      return;
    }
    setBusy('all');
    try {
      if (kind === 'road') await adminWidgetsApi.batchRoad(items as ({ id: number } & RoadEdit)[]);
      else await adminWidgetsApi.batchFuel(items as ({ id: number } & FuelEdit)[]);
      items.forEach((it) =>
        patch(
          [it.id],
          Object.fromEntries(Object.entries(it).filter(([k]) => k !== 'id')) as Record<string, string>,
        ),
      );
      setEdits({});
      toast.success(
        t(kind === 'road' ? 'adminWidgets.status.allSavedRoad' : 'adminWidgets.status.allSavedFuel', {
          count: items.length,
        }),
      );
      refreshStamps();
    } catch (e) {
      toast.error(
        `${errorText(e, t('adminWidgets.status.saveFailed'))} — ${t('adminWidgets.status.nothingSaved')}`,
      );
    } finally {
      setBusy(null);
    }
  };

  const bulkValues = Object.fromEntries(Object.entries(bulk).filter(([, v]) => v !== ''));
  const askBulk = () => {
    if (selectedCount === 0) {
      toast.warning(t('adminWidgets.status.selectFirst'));
      return;
    }
    if (Object.keys(bulkValues).length === 0) {
      toast.warning(
        t(kind === 'road' ? 'adminWidgets.status.chooseDirection' : 'adminWidgets.status.chooseFuel'),
      );
      return;
    }
    setConfirm('bulk');
  };
  const applyBulk = async () => {
    const targets = ordered.filter((r) => selected.has(r.id)).map((r) => r.id);
    setConfirm(null);
    setBusy('bulk');
    try {
      const res =
        kind === 'road'
          ? await adminWidgetsApi.bulkRoad(targets, bulkValues as RoadEdit)
          : await adminWidgetsApi.bulkFuel(targets, bulkValues as FuelEdit);
      patch(targets, bulkValues);
      setEdits((e) => withoutEdits(e, targets, Object.keys(bulkValues)));
      setSelected(new Set());
      setBulk({});
      toast.success(
        t(kind === 'road' ? 'adminWidgets.status.bulkDoneRoad' : 'adminWidgets.status.bulkDoneFuel', {
          count: res.updated ?? targets.length,
        }),
      );
      refreshStamps();
    } catch (e) {
      fail(e, t('adminWidgets.status.bulkFailed'));
    } finally {
      setBusy(null);
    }
  };

  const saveOrder = async () => {
    setBusy('order');
    try {
      await adminWidgetsApi.reorder(cfg.layer, ids);
      await qc.invalidateQueries({ queryKey: adminWidgetKeys.features });
      setOrder(null);
      toast.success(
        t(kind === 'road' ? 'adminWidgets.status.orderSavedRoad' : 'adminWidgets.status.orderSavedFuel'),
      );
    } catch (e) {
      fail(e, t('adminWidgets.status.orderFailed'));
    } finally {
      setBusy(null);
    }
  };

  const reload = () => {
    setConfirm(null);
    void onReload().then(() => {
      setEdits({});
      setOrder(null);
      setSelected(new Set());
    });
  };

  const move = (id: number, delta: number) => setOrder(moveById(ids, id, ids[ids.indexOf(id) + delta] ?? id));

  const columns = useMemo<Column<Row>[]>(
    () => [
      {
        key: 'select',
        header: t('adminWidgets.status.select'),
        card: 'hide',
        className: 'w-10',
        cell: (r) => (
          <Checkbox
            aria-label={t('adminWidgets.status.selectRow', { name: r.name ?? r.id })}
            checked={selected.has(r.id)}
            onChange={(on) => toggle(r.id, on)}
          />
        ),
      },
      {
        key: 'id',
        header: 'ID',
        className: 'w-20',
        cell: (r) => <span className="font-mono text-slate-600">{r.id}</span>,
      },
      {
        key: 'name',
        header: t(kind === 'road' ? 'adminWidgets.status.roadName' : 'adminWidgets.status.fuelName'),
        card: 'title',
        cell: (r) => (
          <div className="flex items-start gap-3">
            {!desktop && (
              <Checkbox
                aria-label={t('adminWidgets.status.selectRow', { name: r.name ?? r.id })}
                checked={selected.has(r.id)}
                onChange={(on) => toggle(r.id, on)}
              />
            )}
            <span className="font-semibold text-slate-900">{r.name || '—'}</span>
          </div>
        ),
      },
      ...fields.map<Column<Row>>((f) => ({
        key: f,
        header: fieldLabel(f),
        className: 'min-w-44',
        card: 'wide',
        cell: (r) => {
          const value = effective(edits, r.id, f, r);
          return (
            <div className="flex items-center gap-2">
              {kind === 'road' && value !== '' && (
                <StatusDot color={roadBarrierStatus(value).color} className="h-3 w-3" />
              )}
              <SelectInput
                className="min-w-0 flex-1"
                inputSize="sm"
                aria-label={`${fieldLabel(f)} — ${r.name ?? r.id}`}
                value={value}
                placeholder={t('adminWidgets.status.notSet')}
                options={options}
                onChange={(e) => choose(r, f, e.target.value)}
              />
            </div>
          );
        },
      })),
      {
        key: 'actions',
        header: t('common.actions'),
        card: 'footer',
        cell: (r) => {
          const i = ids.indexOf(r.id);
          return (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                startIcon={<Save className="h-4 w-4" />}
                loading={busy === `row-${r.id}`}
                onClick={() => void saveRow(r)}
              >
                {t('common.save')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label={t('adminWidgets.moveUp')}
                disabled={i <= 0}
                onClick={() => move(r.id, -1)}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label={t('adminWidgets.moveDown')}
                disabled={i === ids.length - 1}
                onClick={() => move(r.id, 1)}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers close over the state listed here
    [t, kind, desktop, edits, selected, ids, busy, toggle],
  );

  const bulkSummary = fields
    .filter((f) => bulkValues[f])
    .map(
      (f) => `${fieldLabel(f)}: ${optionLabel(optionKeys.find((o) => o.value === bulkValues[f])?.key ?? '')}`,
    )
    .join(' | ');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-800">
          {t(kind === 'road' ? 'adminWidgets.tab.road' : 'adminWidgets.tab.fuelStations')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {dirtyCount > 0 && (
            <Badge tone="amber">{t('adminWidgets.status.unsavedRows', { count: dirtyCount })}</Badge>
          )}
          {orderChanged && <Badge tone="amber">{t('adminWidgets.status.unsavedOrder')}</Badge>}
          <Button
            size="sm"
            startIcon={<SaveAll className="h-4 w-4" />}
            loading={busy === 'all'}
            onClick={() => void saveAll()}
          >
            {t('adminWidgets.status.saveAll')}
          </Button>
          <LastUpdated at={stamp} />
        </div>
      </div>
      <p className="text-sm text-slate-600">
        {kind === 'road' ? t('adminWidgets.status.roadHint') : t('adminWidgets.status.fuelHint')}
      </p>

      <section
        aria-label={t('adminWidgets.status.bulkTitle')}
        className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <strong className="inline-flex items-center gap-2 text-slate-800">
            <Layers className="h-4 w-4" aria-hidden />
            {t('adminWidgets.status.bulkTitle')}
          </strong>
          <span className="text-sm font-semibold text-slate-700">
            {t('adminWidgets.status.selectedOf', { count: selectedCount, total: ordered.length })}
          </span>
          <Checkbox
            label={t('adminWidgets.status.selectAll')}
            checked={ordered.length > 0 && selectedCount === ordered.length}
            indeterminate={selectedCount > 0 && selectedCount < ordered.length}
            onChange={(on) => setSelected(on ? new Set(ordered.map((r) => r.id)) : new Set())}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((f) => (
            <label key={f} className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-slate-700">
              {fieldLabel(f)}
              <SelectInput
                inputSize="sm"
                aria-label={`${t('adminWidgets.status.bulkTitle')} — ${fieldLabel(f)}`}
                value={bulk[f] ?? ''}
                options={[{ value: '', label: t('adminWidgets.status.noChange') }, ...options]}
                onChange={(e) => setBulk((b) => ({ ...b, [f]: e.target.value }))}
              />
            </label>
          ))}
          <div className="flex items-end">
            <Button
              size="sm"
              startIcon={<ListChecks className="h-4 w-4" />}
              loading={busy === 'bulk'}
              onClick={askBulk}
            >
              {t('adminWidgets.status.applyToSelected')}
            </Button>
          </div>
        </div>
        <p className="text-sm text-slate-600">{t('adminWidgets.status.bulkHint')}</p>
      </section>

      <DataTable
        label={t(kind === 'road' ? 'adminWidgets.tab.road' : 'adminWidgets.tab.fuelStations')}
        columns={columns}
        rows={ordered}
        rowKey={(r) => r.id}
        emptyTitle={t(kind === 'road' ? 'adminWidgets.status.noRoad' : 'adminWidgets.status.noFuel')}
        rowClassName={(r) => (edits[r.id] ? 'bg-amber-50' : undefined)}
        onReorder={(from, to) => setOrder(moveById(ids, Number(from), Number(to)))}
      />

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Button
          startIcon={<SaveAll className="h-4 w-4" />}
          loading={busy === 'all'}
          onClick={() => void saveAll()}
        >
          {t('adminWidgets.status.saveAll')}
        </Button>
        <Button
          variant="secondary"
          startIcon={<Save className="h-4 w-4" />}
          loading={busy === 'order'}
          onClick={() => void saveOrder()}
        >
          {t('adminWidgets.status.saveOrder')}
        </Button>
        <Button
          variant="secondary"
          startIcon={<RefreshCw className="h-4 w-4" />}
          onClick={() => (dirtyCount > 0 || orderChanged ? setConfirm('reload') : reload())}
        >
          {t('adminWidgets.refresh')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirm === 'bulk'}
        title={t('adminWidgets.status.bulkConfirmTitle')}
        message={t(
          kind === 'road' ? 'adminWidgets.status.bulkConfirmRoad' : 'adminWidgets.status.bulkConfirmFuel',
          {
            count: selectedCount,
            changes: bulkSummary,
          },
        )}
        onConfirm={() => void applyBulk()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'reload'}
        title={t('adminWidgets.discard.title')}
        message={t('adminWidgets.discard.message')}
        tone="danger"
        onConfirm={reload}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
