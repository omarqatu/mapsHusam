import type { LegalDoc, LegalKey } from './types';

/**
 * The platform's legal and help texts. They are data, not code: one JSON file per document in `texts/<key>.json`
 * (Arabic is the source; an English translation needs the owner's review). The wording is the owner's legal text:
 * do not edit it without them — `legal.content.test.ts` pins every document by hash, so a change is deliberate.
 *
 * Origin: legacy `js/legal-content.js`, moved to structured data instead of HTML strings so it is rendered through JSX
 * (no raw HTML). Mechanical differences: `guideMap` was byte-identical to `guide` (one entry now); the links to
 * `/original-index.html` and `/no-map-search.html` point at the React routes `/` and `/search`; the corrupted emoji in
 * the "search tips" heading is a light bulb; Font Awesome icons are lucide icons.
 *
 * Each document is its own lazy chunk: nothing is downloaded until someone opens it.
 */
const loaders = import.meta.glob<LegalDoc>('./texts/*.json', { import: 'default' });

const pathOf = (key: string) => `./texts/${key}.json`;

/** True for the keys that have a text (`/legal/:key` is a 404 for anything else). */
export const isLegalKey = (key: string | undefined): key is LegalKey =>
  !!key && Object.hasOwn(loaders, pathOf(key));

/** Every document key, from the files in `texts/`. */
export const LEGAL_KEYS = Object.keys(loaders).map((p) =>
  p.slice('./texts/'.length, -'.json'.length),
) as LegalKey[];

export function loadLegalDoc(key: LegalKey): Promise<LegalDoc> {
  const load = loaders[pathOf(key)];
  return load ? load() : Promise.reject(new Error(`No legal text "${key}"`));
}
