import { searchApi } from '@/api/search';
import { toResults, byRatingDesc, type SearchResult } from './results';
import { REAL_ESTATE_TYPE_NAME, type RealEstateLayerKey } from '../config';
import { ALL_TARGETS, targetFromKey, type MapTarget } from '../targets';

// Keyword search across everything. The server searches search_tags, des, and name with Arabic letter variants folded
// together; the words of the text are OR-ed.

/** Fold alef/teh-marbuta/yeh/hamza variants so أ/إ/آ/ا (etc.) compare equal — same folding the server applies. */
export function normalizeArabic(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ةه]/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ؤئء]/g, 'ء')
    .trim();
}

const words = (term: string) => term.split(/\s+/).filter(Boolean);

// --- special words: road-checkpoint status and fuel availability ----------------------------
const BARRIER_KEYWORDS: [string, string[]][] = [
  ['مفتوح', ['0']],
  ['مغلق', ['1']],
  ['ازمة خفيفة', ['2']],
  ['ازمة خانقة', ['3']],
  ['تفتيش', ['4']],
  ['ازمة', ['2', '3', '4']],
  ['حاجز', ['0', '1', '2', '3', '4']],
  ['حواجز', ['0', '1', '2', '3', '4']],
];
const FUEL_KEYWORDS: [string, 'diesel' | 'banzen95' | 'banzen98'][] = [
  ['ديزل', 'diesel'],
  ['سولار', 'diesel'],
  ['بنزين 95', 'banzen95'],
  ['بنزين95', 'banzen95'],
  ['بنزين 98', 'banzen98'],
  ['بنزين98', 'banzen98'],
];

/**
 * Which checkpoint statuses / fuel the text asks for. The LONGEST matching keyword wins
 * ("أزمة خانقة" → heavy only; legacy let the shorter "أزمة" override it and returned every crisis level).
 */
export function specialIntent(term: string): {
  stops: string[] | null;
  fuel: 'diesel' | 'banzen95' | 'banzen98' | null;
} {
  const n = normalizeArabic(term);
  const best = <T>(list: [string, T][]) =>
    list
      .filter(([k]) => n.includes(normalizeArabic(k)))
      .sort((a, b) => normalizeArabic(b[0]).length - normalizeArabic(a[0]).length)[0]?.[1] ?? null;
  return { stops: best(BARRIER_KEYWORDS), fuel: best(FUEL_KEYWORDS) };
}

// --- highlighting (as data, rendered by React — never HTML) ---------------------------------
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A regex source where each Arabic letter matches all its variants. */
function fuzzyPattern(word: string): string {
  return [...word]
    .map((ch) => {
      if ('أإآا'.includes(ch)) return '[أإآا]';
      if ('ةه'.includes(ch)) return '[ةه]';
      if ('ىي'.includes(ch)) return '[ىي]';
      if ('ؤئء'.includes(ch)) return '[ؤئء]';
      return escapeRegex(ch);
    })
    .join('');
}

export interface TextPart {
  text: string;
  match: boolean;
}
export function highlightParts(text: string, term: string): TextPart[] {
  const ws = words(term);
  if (!text || !ws.length) return [{ text, match: false }];
  const re = new RegExp(`(${ws.map(fuzzyPattern).join('|')})`, 'gi');
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), match: false });
    parts.push({ text: m[0], match: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts.length ? parts : [{ text, match: false }];
}

// --- fetching + ranking --------------------------------------------------------------------
export interface GlobalHit {
  result: SearchResult;
  /** Extra line for keyword hits, e.g. "closed (inbound)". Already-translated text is added by the UI from `reason`. */
  reason?: { kind: 'stop'; value: string; direction: 'in' | 'out' } | { kind: 'fuel'; fuel: string };
}

const REAL_ESTATE_TARGETS = ALL_TARGETS.filter((t) => t.kind === 'realEstate');

/** Number of the typed words found in the row's searchable text (ties broken later by title match, then rating). */
export function wordHits(result: SearchResult, term: string): number {
  const hay = normalizeArabic(
    ['name', 'des', 'search_tags', 'location', 'location_name', 'village_a']
      .map((k) => result.props[k] ?? '')
      .join(' '),
  ).toLowerCase();
  return words(normalizeArabic(term)).filter((w) => hay.includes(w.toLowerCase())).length;
}

/**
 * Rank by manual rating descending across both keyword boxes; relevance breaks ties.
 */
export function rankHits(
  hits: GlobalHit[],
  term: string,
  typeTitle: (t: MapTarget) => string,
  _zeroRatingFirst = false,
): GlobalHit[] {
  const n = normalizeArabic(term);
  const scored = hits.map((h) => ({
    h,
    alias: normalizeArabic(typeTitle(h.result.target)).includes(n) ||
      words(n).some((word) => word.length > 2 && normalizeArabic(typeTitle(h.result.target)).includes(word)),
    w: wordHits(h.result, term),
  }));
  // Rating is the platform-wide default ordering. Keep relevance as a tie-breaker only,
  // so zero-rated map suggestions naturally remain after every positive-rated match.
  scored.sort((a, b) => byRatingDesc(a.h.result, b.h.result) || Number(b.alias) - Number(a.alias) || b.w - a.w);
  return scored.map((s) => s.h);
}

const PROPERTY_TYPE_ALIASES: Record<RealEstateLayerKey, string[]> = {
  rent: ['شقة للإيجار', 'شقق للإيجار', 'شقق للايجار', 'شقة ايجار', 'شقق ايجار'],
  sale: ['شقة للبيع', 'شقق للبيع'],
  land: ['أرض للبيع', 'اراضي للبيع', 'أراضي للبيع', 'أرض بيع'],
};

function isPropertyTypeQuery(target: MapTarget, term: string, title: string): boolean {
  if (target.kind !== 'realEstate') return false;
  const queryWords = words(normalizeArabic(term));
  if (!queryWords.length) return false;
  const names = [title, ...PROPERTY_TYPE_ALIASES[target.layer]].map(normalizeArabic);
  return names.some((name) => {
    const nameWords = words(name);
    return queryWords.every((word) => nameWords.some((nameWord) => nameWord.includes(word) || word.includes(nameWord)));
  });
}

/** Runs every query in parallel (legacy ran the three real-estate layers one after another). */
export async function fetchGlobalHits(
  term: string,
  signal?: AbortSignal,
  includeZeroRating = false,
  typeTitle?: (target: MapTarget) => string,
): Promise<GlobalHit[]> {
  const { stops, fuel } = specialIntent(term);
  const text = { field: 'search_tags', operator: 'contains' as const, value: term };

  const jobs: Promise<GlobalHit[]>[] = [
    // every service in ONE request; the row's discriminator says which type it is
    searchApi
      .search({ layer: 'service_all', workspace: 'services', conditions: [text], includeZeroRating }, signal)
      .then((fc) => toResults(fc, null, includeZeroRating).map((result) => ({ result }))),
    ...REAL_ESTATE_TARGETS.map(async (t) => {
      const layer = REAL_ESTATE_TYPE_NAME[(t as { layer: RealEstateLayerKey }).layer];
      // A type-only search (e.g. شقق للبيع) searches the matching property layer.
      // Fetch zero-rated listings separately so the server's 2000-row cap cannot push them out
      // when there are many higher-rated matches. They are sorted after positive ratings below.
      const typeOnly = isPropertyTypeQuery(t, term, typeTitle?.(t) ?? '');
      const regular = searchApi.search(
        {
          layer,
          workspace: 'realestate',
          conditions: typeOnly ? [] : [text],
          includeZeroRating,
          layerNameAr: typeTitle?.(t),
        },
        signal,
      );
      if (!includeZeroRating) {
        return regular.then((fc) => toResults(fc, t).map((result) => ({ result })));
      }
      const zeroRated = searchApi.search(
        {
          layer,
          workspace: 'realestate',
          conditions: typeOnly ? [{ field: 'rating', operator: '=', value: '0' }] : [text, { field: 'rating', operator: '=', value: '0' }],
          includeZeroRating: true,
          layerNameAr: typeTitle?.(t),
        },
        signal,
      );
      const [regularFc, zeroFc] = await Promise.all([regular, zeroRated]);
      return [...toResults(regularFc, t, true), ...toResults(zeroFc, t, true)].map((result) => ({ result }));
    }),
  ];

  if (stops) {
    // same-field conditions are OR-ed by the server, so one request per direction covers every wanted status
    for (const [field, direction] of [
      ['stop', 'in'],
      ['stop2', 'out'],
    ] as const) {
      jobs.push(
        searchApi
          .search(
            {
              layer: 'road_barriers',
              workspace: 'services',
              conditions: stops.map((value) => ({ field, operator: '=' as const, value })),
              includeZeroRating,
            },
            signal,
          )
          .then((fc) =>
            toResults(fc, targetFromKey('road_barriers'), includeZeroRating).map((result) => ({
              result,
              reason: { kind: 'stop' as const, value: String(result.props[field]), direction },
            })),
          ),
      );
    }
  }
  if (fuel) {
    jobs.push(
      searchApi
        .search(
          {
            layer: 'fuel_stations',
            workspace: 'services',
            conditions: [{ field: fuel, operator: '=', value: '0' }],
            includeZeroRating,
          },
          signal,
        )
        .then((fc) =>
          toResults(fc, targetFromKey('fuel_stations'), includeZeroRating).map((result) => ({
            result,
            reason: { kind: 'fuel' as const, fuel },
          })),
        ),
    );
  }

  // One failing query must not blank the others (legacy swallowed each failure the same way).
  const settled = await Promise.allSettled(jobs);
  if (settled.every((s) => s.status === 'rejected') && !signal?.aborted)
    throw (settled[0] as PromiseRejectedResult).reason;
  const all = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));

  // The same feature can come from the text query and from a keyword query (or both directions). One row per feature:
  // the first hit stays, and a keyword hit only adds its reason ("closed, inbound") to it.
  const byKey = new Map<string, GlobalHit>();
  for (const h of all) {
    const existing = byKey.get(h.result.key);
    if (!existing) byKey.set(h.result.key, h);
    else if (!existing.reason && h.reason) byKey.set(h.result.key, { ...existing, reason: h.reason });
  }
  return [...byKey.values()];
}
