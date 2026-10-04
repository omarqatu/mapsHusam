import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Link } from 'react-router';
import type { RichNode } from '@/lib/richText';

// The allow-listed rich-text tree (see `lib/richText.ts`) as ordinary React elements, in the theme's own look.
// Used by `RichText` (reading) and `RichTextEditor` (its starting text). The `data-*` marks carry the formatting the
// classes draw (a framed section, centred text, a block title), so reading the editor back keeps it.

const CLASS: Partial<Record<string, string>> = {
  p: 'leading-relaxed',
  h2: 'text-lg font-black text-fg',
  h3: 'text-base font-bold text-fg',
  h4: 'font-bold text-fg',
  ul: 'list-disc space-y-1 ps-5',
  ol: 'list-decimal space-y-1 ps-5',
  blockquote: 'border-s-4 border-line-strong ps-3 text-muted',
  div: 'space-y-2',
  a: 'font-semibold text-brand-fg underline',
};

/** A framed section: a card for visitors, a quiet side-ruled block in the editor (it reads as a document there). */
const BOX = {
  read: 'rounded-xl border border-line bg-subtle p-4',
  edit: 'rounded-e-lg border-s-4 border-brand/40 bg-subtle/60 py-2 pe-3 ps-4',
};

/** The tree as React elements (also used by the editor to show its starting text, `look = 'edit'`). */
export function renderRich(nodes: RichNode[], prefix = '', look: keyof typeof BOX = 'read'): ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${prefix}${i}`;
    if (typeof n === 'string') return n;
    if (n.tag === 'br') return <br key={key} />;
    const children = renderRich(n.children, `${key}.`, look);
    const className = clsx(CLASS[n.tag], n.center && 'text-center', n.box && BOX[look], n.block && 'block');
    const marks = {
      'data-box': n.box ? '' : undefined,
      'data-center': n.center ? '' : undefined,
      'data-block': n.block ? '' : undefined,
    };
    if (n.tag === 'a' && n.href) {
      return n.href.startsWith('/') ? (
        <Link key={key} to={n.href} className={className} {...marks}>
          {children}
        </Link>
      ) : (
        <a key={key} href={n.href} target="_blank" rel="noopener noreferrer" className={className} {...marks}>
          {children}
        </a>
      );
    }
    const Tag = n.tag;
    return (
      <Tag key={key} dir={n.dir} className={className || undefined} {...marks}>
        {children}
      </Tag>
    );
  });
}
