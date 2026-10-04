import { useMemo } from 'react';
import clsx from 'clsx';
import { parseRichHtml } from '@/lib/richText';
import { renderRich } from './richRender';

// Renders admin-edited rich text (see `lib/richText.ts`) as ordinary React elements, in the theme's own look.

/** Admin-edited rich text, shown safely: only the allow-listed parts of `html` become elements. */
export default function RichText({ html, className }: { html: string; className?: string }) {
  const nodes = useMemo(() => renderRich(parseRichHtml(html)), [html]);
  return <div className={clsx('space-y-3 text-sm text-fg', className)}>{nodes}</div>;
}
