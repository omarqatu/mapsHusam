import { useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowUp, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WidgetGroupKey, WidgetItem } from '@/api/adminWidgets';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import { errorText } from '@/lib/errorText';
import { useSaveGroup } from '../hooks/useAdminWidgets';
import { cleanItems, DEFAULT_ITEMS, GROUP_FIELDS, moveItem, sameItems } from '../model';
import LastUpdated from './LastUpdated';

interface Props {
  groupKey: WidgetGroupKey;
  /** What the server holds (empty = never saved: the legacy defaults are offered as the starting rows). */
  items: WidgetItem[];
  updatedAt: string | null;
  onReload: () => Promise<unknown>;
}

interface Row {
  uid: number;
  item: WidgetItem;
}

function Editor({ groupKey, items, updatedAt, onReload, onDiscard }: Props & { onDiscard: () => void }) {
  const { t } = useTranslation();
  const fields = GROUP_FIELDS[groupKey];
  const start = items.length ? items : DEFAULT_ITEMS[groupKey];
  const [rows, setRows] = useState<Row[]>(() => start.map((item, i) => ({ uid: i, item })));
  const [confirmReload, setConfirmReload] = useState(false);
  const save = useSaveGroup();
  const dirty = !sameItems(
    rows.map((r) => r.item),
    start,
  );

  const edit = (rowUid: number, key: string, value: string) =>
    setRows((rs) => rs.map((r) => (r.uid === rowUid ? { ...r, item: { ...r.item, [key]: value } } : r)));
  const remove = (rowUid: number) => setRows((rs) => rs.filter((r) => r.uid !== rowUid));
  const add = () =>
    setRows((rs) => [
      ...rs,
      {
        uid: Math.max(-1, ...rs.map((r) => r.uid)) + 1,
        item: Object.fromEntries(fields.map((f) => [f.key, ''])) as WidgetItem,
      },
    ]);

  const doSave = () =>
    save.mutate(
      { key: groupKey, items: cleanItems(rows.map((r) => r.item)) },
      {
        onSuccess: () =>
          toast.success(t('adminWidgets.group.saved', { name: t(`adminWidgets.tab.${groupKey}`) })),
        onError: (e) => toast.error(errorText(e, t('adminWidgets.group.saveFailed'))),
      },
    );

  const reload = () => void onReload().then(onDiscard);
  const cols = { '--cols': `repeat(${fields.length}, minmax(0, 1fr)) 7.5rem` } as CSSProperties;
  const grid = 'md:grid-cols-[var(--cols)]';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-800">{t(`adminWidgets.tab.${groupKey}`)}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <Badge tone="amber">{t('adminWidgets.unsaved')}</Badge>}
          <LastUpdated at={updatedAt} />
        </div>
      </div>
      <p className="text-sm text-slate-600">{t('adminWidgets.group.hint')}</p>

      {rows.length === 0 ? (
        <EmptyState title={t('adminWidgets.group.empty')} />
      ) : (
        <div style={cols} role="group" aria-label={t(`adminWidgets.tab.${groupKey}`)}>
          <div className={`hidden gap-2 px-1 pb-1 text-sm font-semibold text-slate-600 md:grid ${grid}`}>
            {fields.map((f) => (
              <span key={f.key}>{t(`adminWidgets.field.${f.label}`)}</span>
            ))}
            <span>{t('common.actions')}</span>
          </div>
          <ul className="space-y-3 md:space-y-2">
            {rows.map((r, i) => {
              const missingId = !r.item.id?.trim() && Object.values(r.item).some((v) => v.trim());
              return (
                <li
                  key={r.uid}
                  className={`grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 md:items-start md:border-0 md:bg-transparent md:p-0 ${grid}`}
                >
                  {fields.map((f) => (
                    <label key={f.key} className="flex min-w-0 flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-600 md:sr-only">
                        {t(`adminWidgets.field.${f.label}`)}
                      </span>
                      <TextInput
                        inputSize="sm"
                        type={f.type === 'date' ? 'date' : 'text'}
                        value={r.item[f.key] ?? ''}
                        placeholder={f.placeholder}
                        hasError={f.key === 'id' && missingId}
                        onChange={(e) => edit(r.uid, f.key, e.target.value)}
                      />
                      {f.key === 'id' && missingId && (
                        <span role="alert" className="text-xs font-medium text-red-700">
                          {t('adminWidgets.group.needsId')}
                        </span>
                      )}
                    </label>
                  ))}
                  <div className="flex items-center gap-1 md:pt-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={t('adminWidgets.moveUp')}
                      disabled={i === 0}
                      onClick={() => setRows((rs) => moveItem(rs, i, i - 1))}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={t('adminWidgets.moveDown')}
                      disabled={i === rows.length - 1}
                      onClick={() => setRows((rs) => moveItem(rs, i, i + 1))}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={t('common.delete')}
                      onClick={() => remove(r.uid)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" startIcon={<Plus className="h-4 w-4" />} onClick={add}>
          {t('adminWidgets.group.add')}
        </Button>
        <Button startIcon={<Save className="h-4 w-4" />} onClick={doSave} loading={save.isPending}>
          {t('adminWidgets.group.save')}
        </Button>
        <Button
          variant="secondary"
          startIcon={<RefreshCw className="h-4 w-4" />}
          onClick={() => (dirty ? setConfirmReload(true) : reload())}
        >
          {t('adminWidgets.refresh')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmReload}
        title={t('adminWidgets.discard.title')}
        message={t('adminWidgets.discard.message')}
        tone="danger"
        onConfirm={() => {
          setConfirmReload(false);
          reload();
        }}
        onCancel={() => setConfirmReload(false)}
      />
    </div>
  );
}

/** One of the seven hand-edited groups: rows of text fields, add / delete / reorder, one save for the whole group. */
export default function GroupPanel(props: Props) {
  // Re-key on the server's stamp (a saved group restarts from what was stored) and on an explicit refresh.
  const [rev, setRev] = useState(0);
  return <Editor key={`${props.updatedAt}:${rev}`} {...props} onDiscard={() => setRev((r) => r + 1)} />;
}
