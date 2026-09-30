import { memo, useImperativeHandle, useMemo, useRef, type ClipboardEvent, type ReactNode, type Ref } from 'react';
import {
  AlignCenter,
  Bold,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Pilcrow,
  RemoveFormatting,
  Underline,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { richFromElement, safeUrl, sanitizeRichHtml, type RichNode } from '@/lib/richText';
import { renderRich } from './richRender';

export interface RichTextEditorHandle {
  /** What is in the editor now, through the same allow-list as everything else. */
  read: () => RichNode[];
}

/**
 * The editable surface. It is rendered once from the starting text and then belongs to the browser (the user types into
 * it); React must not re-render it, or it would fight the edits — hence `memo` with a stable `nodes` and `onInput`.
 * A new starting text = a new `key` from the parent.
 */
const Surface = memo(function Surface({
  nodes,
  label,
  onInput,
  onPaste,
  surfaceRef,
}: {
  nodes: ReactNode[];
  label: string;
  onInput: () => void;
  onPaste: (e: ClipboardEvent<HTMLDivElement>) => void;
  surfaceRef: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={surfaceRef}
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      onInput={onInput}
      onPaste={onPaste}
      className="min-h-80 space-y-3 rounded-b-xl border border-t-0 border-line bg-surface p-4 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {nodes}
    </div>
  );
});

function ToolButton({ label, onRun, children }: { label: string; onRun: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // keep the selection in the text: act on mouse down, before the button takes the focus
      onMouseDown={(e) => {
        e.preventDefault();
        onRun();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRun();
        }
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg hover:bg-subtle focus-visible:outline-2 focus-visible:outline-brand"
    >
      {children}
    </button>
  );
}

/** The toolbar: an editing command of the browser each (`createLink` asks for the address first). */
const TOOLS: { id: string; Icon: LucideIcon; command: string; value?: string }[] = [
  { id: 'bold', Icon: Bold, command: 'bold' },
  { id: 'italic', Icon: Italic, command: 'italic' },
  { id: 'underline', Icon: Underline, command: 'underline' },
  { id: 'heading', Icon: Heading3, command: 'formatBlock', value: 'h3' },
  { id: 'paragraph', Icon: Pilcrow, command: 'formatBlock', value: 'p' },
  { id: 'bullets', Icon: List, command: 'insertUnorderedList' },
  { id: 'numbers', Icon: ListOrdered, command: 'insertOrderedList' },
  { id: 'center', Icon: AlignCenter, command: 'justifyCenter' },
  { id: 'link', Icon: Link2, command: 'createLink' },
  { id: 'unlink', Icon: Link2Off, command: 'unlink' },
  { id: 'clear', Icon: RemoveFormatting, command: 'removeFormat' },
];

/**
 * A small rich-text editor for the platform texts: bold / italic / underline, heading and paragraph, lists, centring,
 * links, clear formatting. The browser's editing commands do the work; what is kept is decided by `lib/richText` when
 * the text is read (`handle.read()`), so pasted markup never survives beyond the allow-list.
 */
export default function RichTextEditor({
  initial,
  label,
  onChange,
  handle,
}: {
  initial: RichNode[];
  label: string;
  /** Called on every edit (the page tracks "unsaved changes"). Keep it stable (`useCallback`): the surface never re-renders. */
  onChange: () => void;
  handle: Ref<RichTextEditorHandle>;
}) {
  const { t } = useTranslation();
  const surface = useRef<HTMLDivElement>(null);
  const nodes = useMemo(() => renderRich(initial), [initial]);

  useImperativeHandle(handle, () => ({ read: () => (surface.current ? richFromElement(surface.current) : []) }), []);

  const run = (command: string, value?: string) => {
    surface.current?.focus();
    document.execCommand('styleWithCSS', false, 'false');
    if (command === 'createLink') {
      const href = safeUrl(window.prompt(t('texts.editor.linkPrompt'), 'https://'));
      if (!href) return;
      value = href;
    }
    document.execCommand(command, false, value);
    onChange();
  };

  // Pasted content goes through the allow-list before it touches the page (from Word, a web page, anywhere).
  const pasteClean = useMemo(
    () => (e: ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      document.execCommand('styleWithCSS', false, 'false');
      if (html) document.execCommand('insertHTML', false, sanitizeRichHtml(html));
      else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    },
    [],
  );

  return (
    <div>
      <div
        role="toolbar"
        aria-label={t('texts.editor.toolbar')}
        className="flex flex-wrap gap-0.5 rounded-t-xl border border-line bg-subtle p-1"
      >
        {TOOLS.map(({ id, Icon, command, value }) => (
          <ToolButton key={id} label={t(`texts.editor.${id}`)} onRun={() => run(command, value)}>
            <Icon className="h-4 w-4" />
          </ToolButton>
        ))}
      </div>
      <Surface nodes={nodes} label={label} onInput={onChange} onPaste={pasteClean} surfaceRef={surface} />
    </div>
  );
}
