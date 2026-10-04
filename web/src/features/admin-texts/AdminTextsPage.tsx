import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArchiveRestore, FileText, History, RotateCcw, Save, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FormField from '@/components/ui/FormField';
import PageHeader from '@/components/ui/PageHeader';
import SelectInput from '@/components/ui/SelectInput';
import { CenteredSpinner } from '@/components/ui/Spinner';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import RichTextEditor, { type RichTextEditorHandle } from '@/components/RichTextEditor';
import ContactSettingsCard from '@/features/contact/ContactSettingsCard';
import { legalDocToRich } from '@/features/legal/docToRich';
import type { LegalOverride } from '@/features/legal/overrides';
import type { LegalKey } from '@/features/legal/types';
import { useLegalDoc } from '@/features/legal/useLegalDoc';
import { errorText } from '@/lib/errorText';
import { formatDateTime } from '@/lib/format';
import { parseRichHtml, richPlainText, richTreeToHtml, type RichNode } from '@/lib/richText';
import { useTextAction, useTextStates, type TextState } from './hooks';
import UiTextsEditor from './UiTextsEditor';

/** A document of the list: one of the legal texts, or the interface texts (`ui`). */
type DocId = LegalKey | 'ui';

/** The list, in the order an admin looks for a text. */
const GROUPS: { id: 'pages' | 'guides' | 'site'; docs: DocId[] }[] = [
  { id: 'pages', docs: ['terms', 'privacy', 'about', 'contact'] },
  { id: 'guides', docs: ['guide', 'guideSearch', 'guideProvider', 'guideSubscription', 'guideMapInteractive'] },
  { id: 'site', docs: ['ui'] },
];

/** One text: the editor starts from the admin's replacement if there is one, else from the built-in text. */
function TextEditor({
  docKey,
  state,
  onDirty,
}: {
  docKey: LegalKey;
  state: TextState;
  /** The page asks before leaving a text with unsaved changes. */
  onDirty: (dirty: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const { doc } = useLegalDoc(docKey);
  const action = useTextAction();
  const editor = useRef<RichTextEditorHandle>(null);

  const opened = useMemo<{ title: string; nodes: RichNode[] } | null>(() => {
    if (state.custom) return { title: state.custom.title, nodes: parseRichHtml(state.custom.html) };
    return doc ? { title: doc.title, nodes: legalDocToRich(doc) } : null;
  }, [state.custom, doc]);

  // What the editor shows: the opened text, or one loaded into it (a backup, "undo"). A new version remounts the surface.
  const [loaded, setLoaded] = useState<{ title: string; nodes: RichNode[]; version: number } | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDefault, setConfirmDefault] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  if (!opened) return <CenteredSpinner />;
  const shown = loaded ?? { ...opened, version: 0 };
  const currentTitle = title ?? shown.title;

  const load = (text: { title: string; nodes: RichNode[] }, isChange: boolean) => {
    setLoaded({ ...text, version: shown.version + 1 });
    setTitle(null);
    setDirty(isChange);
  };
  const read = (): LegalOverride | null => {
    const nodes = editor.current?.read() ?? [];
    if (!richPlainText(nodes).trim() || !currentTitle.trim()) {
      toast.error(t('texts.empty'));
      return null;
    }
    return { title: currentTitle.trim(), html: richTreeToHtml(nodes) };
  };
  const done = (message: string) => ({
    onSuccess: () => toast.success(message),
    onError: (e: unknown) => toast.error(errorText(e, t('texts.failed'))),
  });

  const save = () => {
    const text = read();
    if (!text) return;
    // only a saved text is "not dirty" (a failed save keeps the warning and the button)
    action.mutate(
      { kind: 'save', key: docKey, text },
      {
        onSuccess: () => {
          toast.success(t('texts.saved'));
          setDirty(false);
        },
        onError: (e) => toast.error(errorText(e, t('texts.failed'))),
      },
    );
  };
  const backup = () => {
    const text = read();
    if (text) action.mutate({ kind: 'backup', key: docKey, text }, done(t('texts.backupSaved')));
  };
  const restoreDefault = () =>
    action.mutate(
      { kind: 'restoreDefault', key: docKey },
      {
        ...done(t('texts.defaultRestored')),
        onSettled: () => {
          setConfirmDefault(false);
          setLoaded(null);
          setTitle(null);
          setDirty(false);
        },
      },
    );

  const stamp = (iso: string) => formatDateTime(iso, i18n.language);

  return (
    <div>
      {/* stays in view while the text scrolls: what this is, whether it is saved, and the two actions */}
      <div className="sticky top-14 z-20 -mx-3 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface/95 px-3 py-3 backdrop-blur md:-mx-5 md:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-black text-fg">{t(`texts.keys.${docKey}`)}</h2>
          <p className="text-sm text-muted">
            {dirty ? (
              <span className="font-semibold text-warn">{t('texts.unsaved')}</span>
            ) : state.custom ? (
              t('texts.statusCustom', { when: stamp(state.custom.updatedAt) })
            ) : (
              t('texts.statusDefault')
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            startIcon={<Undo2 className="h-4 w-4" aria-hidden />}
            disabled={!dirty || action.isPending}
            onClick={() => load(opened, false)}
          >
            {t('texts.discard')}
          </Button>
          <Button
            startIcon={<Save className="h-4 w-4" aria-hidden />}
            disabled={!dirty}
            loading={action.isPending && action.variables?.kind === 'save'}
            onClick={save}
          >
            {t('texts.save')}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <FormField label={t('texts.titleLabel')} name={`text-title-${docKey}`}>
          <TextInput
            id={`text-title-${docKey}`}
            value={currentTitle}
            className="text-base font-bold"
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
          />
        </FormField>

        <RichTextEditor
          // a new starting text remounts the surface (React never redraws over what the admin typed)
          key={`${docKey}:${shown.version}:${state.custom?.updatedAt ?? 'built-in'}`}
          initial={shown.nodes}
          label={t('texts.bodyLabel')}
          onChange={markDirty}
          handle={editor}
        />

        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-subtle p-3">
          <span className="me-auto text-sm font-semibold text-muted">
            {state.backup ? t('texts.backupFrom', { when: stamp(state.backup.updatedAt) }) : t('texts.noBackup')}
          </span>
          <Button
            variant="secondary"
            size="sm"
            startIcon={<ArchiveRestore className="h-4 w-4" aria-hidden />}
            loading={action.isPending && action.variables?.kind === 'backup'}
            onClick={backup}
          >
            {t('texts.saveBackup')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            startIcon={<History className="h-4 w-4" aria-hidden />}
            disabled={!state.backup}
            onClick={() =>
              state.backup && load({ title: state.backup.title, nodes: parseRichHtml(state.backup.html) }, true)
            }
          >
            {t('texts.loadBackup')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            startIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
            disabled={!state.custom}
            onClick={() => setConfirmDefault(true)}
          >
            {t('texts.restoreDefault')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDefault}
        title={t('texts.restoreDefault')}
        message={t('texts.restoreDefaultConfirm')}
        confirmLabel={t('texts.restoreDefault')}
        tone="danger"
        loading={action.isPending}
        onConfirm={restoreDefault}
        onCancel={() => setConfirmDefault(false)}
      />
    </div>
  );
}

/**
 * `/admin/texts` — the platform texts (terms, privacy, about, contact, the guides) and the interface texts: the admin
 * replaces the built-in wording, keeps a backup copy, or goes back to the built-in text (legacy `texts-admin.html`).
 * A list of the documents on the side (a drop-down on phones), the open one as a single sheet.
 */
export default function AdminTextsPage() {
  const { t } = useTranslation();
  const [key, setKey] = useState<DocId>('terms');
  const [dirty, setDirty] = useState(false);
  const [leaveTo, setLeaveTo] = useState<DocId | null>(null);
  const states = useTextStates();

  const edited = (id: DocId) => id !== 'ui' && !!states.data?.(id).custom;
  const name = (id: DocId) => (id === 'ui' ? t('texts.ui.tab') : t(`texts.keys.${id}`));
  const open = (id: DocId) => {
    if (id === key) return;
    if (dirty) setLeaveTo(id);
    else setKey(id);
  };
  const onDirty = useCallback((d: boolean) => setDirty(d), []);

  return (
    <>
      <PageHeader
        title={t('texts.title')}
        description={t('texts.subtitle')}
        icon={<FileText className="h-6 w-6" aria-hidden />}
      />
      <ContactSettingsCard />
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <nav
          aria-label={t('texts.title')}
          className="hidden rounded-2xl border border-line bg-surface p-2 shadow-sm lg:sticky lg:top-20 lg:block"
        >
          {GROUPS.map((g) => (
            <div key={g.id} className="py-1">
              <p className="px-3 pb-1 pt-2 text-xs font-bold text-muted">{t(`texts.groups.${g.id}`)}</p>
              <ul>
                {g.docs.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      aria-current={key === id ? 'page' : undefined}
                      onClick={() => open(id)}
                      className={clsx(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-start text-sm transition-colors',
                        'focus-visible:outline-2 focus-visible:outline-brand',
                        key === id ? 'bg-brand-light font-bold text-brand-fg' : 'text-fg hover:bg-subtle',
                      )}
                    >
                      <span className="truncate">{name(id)}</span>
                      {edited(id) && (
                        <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand-fg">
                          {t('texts.edited')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="min-w-0 rounded-2xl border border-line bg-surface px-3 pb-4 shadow-sm md:px-5">
          <div className="pt-3 lg:hidden">
            <SelectInput
              aria-label={t('texts.pick')}
              value={key}
              onChange={(e) => open(e.target.value as DocId)}
              options={GROUPS.flatMap((g) =>
                g.docs.map((id) => ({
                  value: id,
                  label: edited(id) ? `${name(id)} · ${t('texts.edited')}` : name(id),
                  group: t(`texts.groups.${g.id}`),
                })),
              )}
            />
          </div>
          {key === 'ui' ? (
            <div className="pt-4">
              <UiTextsEditor />
            </div>
          ) : states.isPending ? (
            <CenteredSpinner />
          ) : states.isError ? (
            <AlertMessage className="mt-4" type="error" message={errorText(states.error, t('texts.loadFailed'))} />
          ) : (
            <TextEditor key={key} docKey={key} state={states.data(key)} onDirty={onDirty} />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={leaveTo !== null}
        title={t('texts.leave.title')}
        message={t('texts.leave.message')}
        confirmLabel={t('texts.leave.confirm')}
        tone="danger"
        onConfirm={() => {
          if (leaveTo) setKey(leaveTo);
          setDirty(false);
          setLeaveTo(null);
        }}
        onCancel={() => setLeaveTo(null)}
      />
    </>
  );
}
