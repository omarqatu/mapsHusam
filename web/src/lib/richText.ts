// Admin-edited rich text (the platform texts in `platform_content`, written by an HTML editor) as data, never as markup.
//
// The stored HTML is parsed by `DOMParser` into an inert document (no script runs, nothing is fetched) and walked; only an
// allow-list survives, as a small neutral tree (`RichNode`). That tree is then either rendered as React elements
// (`components/RichText.tsx`) or written back as clean HTML for saving (`richTreeToHtml`). No HTML string is ever handed
// to the DOM as markup. Kept: paragraphs, headings, bold / italic / underline, lists, quotes, line breaks, links with a
// safe address, the writing direction, centred text, and "boxes" (a block that had a background colour — shown in the
// theme's own colours). Dropped with their content: scripts, styles, forms, buttons, media. Anything else is unwrapped.

export type RichTag =
  'p' | 'h2' | 'h3' | 'h4' | 'ul' | 'ol' | 'li' | 'blockquote' | 'div' | 'strong' | 'em' | 'u' | 'a' | 'br';

export interface RichElement {
  tag: RichTag;
  children: RichNode[];
  dir?: 'rtl' | 'ltr';
  center?: boolean;
  /** A `div` that had a background: drawn as a card. */
  box?: boolean;
  /** A `strong` that was `display:block` (a card title in the legacy texts). */
  block?: boolean;
  href?: string;
}
export type RichNode = string | RichElement;

const TAG_MAP: Record<string, RichTag> = {
  p: 'p',
  h1: 'h2',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h4',
  h6: 'h4',
  ul: 'ul',
  ol: 'ol',
  li: 'li',
  blockquote: 'blockquote',
  div: 'div',
  section: 'div',
  article: 'div',
  strong: 'strong',
  b: 'strong',
  em: 'em',
  i: 'em',
  u: 'u',
  a: 'a',
  br: 'br',
};

/** Removed together with everything inside them. */
const DROP = new Set([
  'script',
  'style',
  'template',
  'noscript',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'select',
  'textarea',
  'button',
  'img',
  'video',
  'audio',
  'svg',
  'math',
  'canvas',
  'link',
  'meta',
  'head',
  'title',
]);

/**
 * A link address that is safe to put in `href`: `http(s)://`, `mailto:`, `tel:` or an in-app path (`/…`, not `//…`).
 * Everything else (`javascript:`, `data:`, relative junk) gives `null`.
 */
export function safeUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? '').trim();
  if (!url) return null;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const u = new URL(url);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

function convertChildren(nodes: ArrayLike<ChildNode>): RichNode[] {
  const out: RichNode[] = [];
  for (const n of Array.from(nodes)) out.push(...convert(n));
  return out;
}

function convert(node: ChildNode): RichNode[] {
  if (node.nodeType === 3) return node.textContent ? [node.textContent] : [];
  if (node.nodeType !== 1) return []; // comments, processing instructions
  const el = node as Element;
  const name = el.tagName.toLowerCase();
  if (DROP.has(name)) return [];
  const children = convertChildren(el.childNodes);
  const tag = TAG_MAP[name];
  if (!tag) return children; // span, font, unknown: keep the text, lose the wrapper

  const style = (el.getAttribute('style') ?? '').toLowerCase();
  const dir = el.getAttribute('dir')?.toLowerCase();
  // Lists hold only items: the indentation between them is not text.
  const kept = tag === 'ul' || tag === 'ol' ? children.filter((c) => typeof c !== 'string' || c.trim()) : children;
  const out: RichElement = { tag, children: tag === 'br' ? [] : kept };
  if (dir === 'rtl' || dir === 'ltr') out.dir = dir;
  // Stored HTML says it with styles; the page (and the editor) with the `data-*` marks of `renderRich`.
  const align = el.getAttribute('align')?.toLowerCase();
  if (/text-align\s*:\s*center/.test(style) || align === 'center' || el.hasAttribute('data-center')) out.center = true;
  if (tag === 'div' && (/background(-color)?\s*:/.test(style) || el.hasAttribute('data-box'))) out.box = true;
  if (tag === 'strong' && (/display\s*:\s*block/.test(style) || el.hasAttribute('data-block'))) out.block = true;
  if (tag === 'a') {
    const href = safeUrl(el.getAttribute('href'));
    if (!href) return children; // a link to nowhere safe is just its text
    out.href = href;
  }
  return [out];
}

/** A live element's content → the allow-listed tree (the editor is read this way, never as a markup string). */
export const richFromElement = (el: Element): RichNode[] => convertChildren(el.childNodes);

/** Stored HTML → the allow-listed tree. Empty for empty input (and outside a browser). */
export function parseRichHtml(html: string | null | undefined): RichNode[] {
  if (!html || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return convertChildren(doc.body.childNodes);
}

const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, '&quot;');

/** The tree → clean HTML (what the texts page saves). Styles are only the few the parser reads back. */
export function richTreeToHtml(nodes: RichNode[]): string {
  return nodes
    .map((n) => {
      if (typeof n === 'string') return escapeText(n);
      if (n.tag === 'br') return '<br>';
      const attrs: string[] = [];
      if (n.dir) attrs.push(`dir="${n.dir}"`);
      if (n.href) attrs.push(`href="${escapeAttr(n.href)}"`);
      const style = [
        n.box && 'background-color:#f8f9fa;padding:16px',
        n.block && 'display:block',
        n.center && 'text-align:center',
      ].filter(Boolean);
      if (style.length) attrs.push(`style="${style.join(';')}"`);
      const open = attrs.length ? `<${n.tag} ${attrs.join(' ')}>` : `<${n.tag}>`;
      return `${open}${richTreeToHtml(n.children)}</${n.tag}>`;
    })
    .join('');
}

/** Any HTML → the same HTML with only the allowed parts (used on every save). */
export const sanitizeRichHtml = (html: string) => richTreeToHtml(parseRichHtml(html));

/** Visible text only (to tell an empty editor from a real text). */
export function richPlainText(nodes: RichNode[]): string {
  return nodes.map((n) => (typeof n === 'string' ? n : richPlainText(n.children))).join('');
}
