import { safeUrl, type RichElement, type RichNode } from '@/lib/richText';
import type { LegalBlock, LegalCard, LegalCallout, LegalDoc, LegalInline, LegalPanelBody } from './types';

// A built-in (structured) text as rich text: the starting point of the editor on the texts page when the admin has not
// replaced it yet. Cards, panels and callouts become boxes; icons are left out (the editor has none).

const el = (tag: RichElement['tag'], children: RichNode[], extra: Partial<RichElement> = {}): RichElement => ({
  tag,
  children,
  ...extra,
});

function inline(parts: LegalInline[]): RichNode[] {
  return parts.flatMap((p): RichNode[] => {
    if (typeof p === 'string') return [p];
    if ('strong' in p) return [el('strong', [p.strong])];
    if ('link' in p) {
      const href = safeUrl(p.link);
      return href ? [el('a', [p.text], { href })] : [p.text];
    }
    return []; // icons
  });
}

function action(a: { href: string; text: string }): RichNode[] {
  const href = safeUrl(a.href);
  return [el('p', href ? [el('a', [a.text], { href })] : [a.text])];
}

function card(c: LegalCard | LegalCallout): RichElement {
  if (c.kind === 'callout') return el('div', [el('p', inline(c.text))], { box: true });
  return el('div', [el('h4', [c.title]), el('p', inline(c.text)), ...(c.action ? action(c.action) : [])], { box: true });
}

function panelBody(b: LegalPanelBody): RichNode[] {
  if (b.kind === 'text') return [el('p', inline(b.text))];
  if (b.kind === 'list') return [el('ul', b.items.map((i) => el('li', inline(i))))];
  if (b.kind === 'stats') return [el('ul', b.items.map((i) => el('li', [el('strong', [i.value]), ` ${i.label}`])))];
  return action(b);
}

function block(b: LegalBlock): RichNode[] {
  switch (b.kind) {
    case 'title':
      return [el('h2', [b.title], { center: true }), el('p', [b.subtitle], { center: true })];
    case 'intro':
      return [el('p', inline(b.text))];
    case 'callout':
      return [card(b)];
    case 'cards':
      return b.items.map(card);
    case 'panel':
      return [el('div', [el('h3', [b.title]), ...b.body.flatMap(panelBody)], { box: true })];
  }
}

export const legalDocToRich = (doc: LegalDoc): RichNode[] => doc.blocks.flatMap(block);
