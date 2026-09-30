import { platformContentApi } from '@/api/platformContent';
import type { LegalKey } from './types';

// The admin can replace a text (the texts page, `/admin/texts`; Husam's legacy `texts-admin.html` writes the same rows):
// `platform_content` row `legal.<key>` = JSON `{title, html}`. No row = the built-in text of `texts/<key>.json`.
// `legal.backup.<key>` is the admin's saved backup copy (same shape), never shown to visitors.

export interface LegalOverride {
  title: string;
  html: string;
}

export const overrideKey = (key: LegalKey) => `legal.${key}`;
export const backupKey = (key: LegalKey) => `legal.backup.${key}`;

/** Stored value → override; anything unreadable counts as "no override" (the built-in text shows). */
export function parseOverride(raw: string | null | undefined): LegalOverride | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { title?: unknown; html?: unknown };
    if (typeof v.html !== 'string' || !v.html.trim()) return null;
    return { title: typeof v.title === 'string' ? v.title : '', html: v.html };
  } catch {
    return null;
  }
}

export const serializeOverride = (o: LegalOverride) => JSON.stringify({ title: o.title, html: o.html });

/** One stored row as an override; a missing row (`item: null`) is `null`. */
export async function fetchOverride(contentKey: string): Promise<LegalOverride | null> {
  return parseOverride((await platformContentApi.get(contentKey)).item?.content_value);
}
