import { useCallback, useMemo, useRef, useState } from 'react';
import { ArchiveRestore, FileText, History, RotateCcw, Save, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FormField from '@/components/ui/FormField';
import PageHeader from '@/components/ui/PageHeader';
import { CenteredSpinner } from '@/components/ui/Spinner';
import Tabs, { type TabDef } from '@/components/ui/Tabs';
import TextInput from '@/components/ui/TextInput';
import { toast } from '@/components/ui/toastStore';
import RichTextEditor, { type RichTextEditorHandle } from '@/components/RichTextEditor';
import { legalDocToRich } from '@/features/legal/docToRich';
import type { LegalOverride } from '@/features/legal/overrides';
import type { LegalKey } from '@/features/legal/types';
import { useLegalDoc } from '@/features/legal/useLegalDoc';
import { errorText } from '@/lib/errorText';
import { formatDateTime } from '@/lib/format';
import { parseRichHtml, richPlainText, richTreeToHtml, type RichNode } from '@/lib/richText';
import { useTextAction, useTextStates, type TextState } from './hooks';
import UiTextsEditor from './UiTextsEditor';

/** A tab: one of the legal texts, or the interface texts (`ui`). */
type TabId = LegalKey | 'ui';

/** The texts in the order an admin looks for them. */
const KEYS: LegalKey[] = [
  'terms',
  'privacy',
  'about',
  'contact',
  'guide',
  'guideSearch',
  'guideProvider',
  'guideSubscription',
  'guideMapInteractive',
];

/** One text: the editor starts from the admin's replacement if there is one, else from the built-in text. */
function TextEditor({ docKey, state }: { docKey: LegalKey; state: TextState }) {
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
    if (text) action.mutate({ kind: 'save', key: docKey, text }, { ...done(t('texts.saved')), onSettled: () => setDirty(false) });
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {state.custom
            ? t('texts.statusCustom', { when: stamp(state.custom.updatedAt) })
            : t('texts.statusDefault')}
          {dirty && <span className="ms-2 font-semibold text-warn">· {t('texts.unsaved')}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            startIcon={<Undo2 className="h-4 w-4" aria-hidden />}
            disabled={!dirty || action.isPending}
            onClick={() => load(opened, false)}
          >
            {t('texts.discard')}
          </Button>
          <Button
            size="sm"
            startIcon={<Save className="h-4 w-4" aria-hidden />}
            disabled={!dirty}
            loading={action.isPending && action.variables?.kind === 'save'}
            onClick={save}
          >
            {t('texts.save')}
          </Button>
        </div>
      </div>

      <FormField label={t('texts.titleLabel')} name={`text-title-${docKey}`}>
        <TextInput
          id={`text-title-${docKey}`}
          value={currentTitle}
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

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
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
          onClick={() => state.backup && load({ title: state.backup.title, nodes: parseRichHtml(state.backup.html) }, true)}
          title={state.backup ? t('texts.backupFrom', { when: stamp(state.backup.updatedAt) }) : t('texts.noBackup')}
        >
          {t('texts.loadBackup')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="ms-auto"
          startIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
          disabled={!state.custom}
          onClick={() => setConfirmDefault(true)}
        >
          {t('texts.restoreDefault')}
        </Button>
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
 * `/admin/texts` — the platform texts (terms, privacy, about, contact, the guides): the admin replaces the built-in
 * wording with their own, keeps a backup copy, or goes back to the built-in text (legacy `texts-admin.html`, same rows).
 */
export default function AdminTextsPage() {
  const { t } = useTranslation();
  const [key, setKey] = useState<TabId>(KEYS[0]);
  const states = useTextStates();

  const tabs: TabDef<TabId>[] = [
    ...KEYS.map((k) => ({
      id: k as TabId,
      label: t(`texts.keys.${k}`),
      icon: states.data?.(k).custom ? (
        <span className="h-2 w-2 rounded-full bg-brand" aria-label={t('texts.edited')} />
      ) : undefined,
    })),
    { id: 'ui', label: t('texts.ui.tab') },
  ];

  return (
    <>
      <PageHeader
        title={t('texts.title')}
        description={t('texts.subtitle')}
        icon={<FileText className="h-6 w-6" aria-hidden />}
      />
      <div className="rounded-2xl border border-line bg-surface p-3 shadow-sm md:p-4">
        <Tabs scrollable className="mb-4" label={t('texts.title')} idPrefix="texts" tabs={tabs} value={key} onChange={setKey} />
        <div role="tabpanel" id={`texts-tabpanel-${key}`} aria-labelledby={`texts-tab-${key}`}>
          {key === 'ui' ? (
            <UiTextsEditor />
          ) : states.isPending ? (
            <CenteredSpinner />
          ) : states.isError ? (
            <AlertMessage type="error" message={errorText(states.error, t('texts.loadFailed'))} />
          ) : (
            <TextEditor key={key} docKey={key} state={states.data(key)} />
          )}
        </div>
      </div>
    </>
  );
}
