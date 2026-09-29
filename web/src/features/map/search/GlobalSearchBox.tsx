import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { passesSearchQuota } from '@/lib/searchQuota';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { roadBarrierStatus } from '../config';
import { useOlMap } from '../MapContext';
import { targetIcon } from '../targets';
import { useMapUi } from '../store';
import { fetchGlobalHits, highlightParts, rankHits, type GlobalHit } from './globalSearch';
import { targetLabelKey } from '../targets';
import { toSelected } from './results';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 400; // legacy value
const MAX_SHOWN = 50;

function Highlighted({ text, term }: { text: string; term: string }) {
  return (
    <>
      {highlightParts(text, term).map((p, i) =>
        p.match ? (
          <mark key={i} className="rounded bg-warn-soft px-0.5 text-inherit">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Search box over the map: type any word (service, area, phone tag, "closed checkpoint", "diesel"…) → ranked suggestions. */
export default function GlobalSearchBox() {
  const { t } = useTranslation();
  const map = useOlMap();
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const clean = text.trim();
    const id = setTimeout(() => setTerm(clean.length >= MIN_CHARS ? clean : ''), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text]);

  const query = useQuery({
    queryKey: ['global-search', term],
    enabled: term !== '',
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      // Counts against the same per-user quota as every other search; blocked → no request.
      if (!(await passesSearchQuota('global_search', term, t))) return [] as GlobalHit[];
      return fetchGlobalHits(term, signal);
    },
    select: (hits) => rankHits(hits, term, (target) => t(targetLabelKey(target))).slice(0, MAX_SHOWN),
  });

  const closeList = useCallback(() => setOpen(false), []);
  useOutsideClick(root, closeList);

  const hits = query.data ?? [];
  const showPanel = open && term !== '';

  const pick = (h: GlobalHit) => {
    setOpen(false);
    map?.getView().animate({ center: h.result.center, zoom: 19, duration: 1000 });
    useMapUi.getState().setSelected(toSelected(h.result));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showPanel) e.preventDefault(); // only the suggestions close
      setOpen(false);
      return;
    }
    if (!showPanel || !hits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(hits[active]);
    }
  };

  const reasonText = (h: GlobalHit) => {
    if (h.reason?.kind === 'stop')
      return t(`search.reason.stop.${h.reason.direction}`, {
        status: t(`roadStatus.${roadBarrierStatus(h.reason.value).key}`),
      });
    if (h.reason?.kind === 'fuel') return t('search.reason.fuel', { fuel: t(`popup.fuel.${h.reason.fuel}`) });
    return '';
  };

  return (
    <div ref={root} className="relative">
      <div className="flex items-center gap-2 glass rounded-full border-2 px-4 transition-shadow focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <input
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={`${uid}-list`}
          aria-activedescendant={active >= 0 ? `${uid}-opt-${active}` : undefined}
          aria-autocomplete="list"
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={t('search.globalPlaceholder')}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => {
              setText('');
              setTerm('');
              setOpen(false);
            }}
            className="rounded p-1 text-muted hover:bg-subtle"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl bg-surface shadow-xl">
          {query.isFetching && !hits.length ? (
            <CenteredSpinner minHeight="6rem" size="sm" />
          ) : query.isError ? (
            <p className="p-4 text-sm text-danger">{t('search.failed')}</p>
          ) : !hits.length ? (
            <p className="p-4 text-sm text-muted">{t('search.globalNone')}</p>
          ) : (
            <ul id={`${uid}-list`} role="listbox">
              {hits.map((h, i) => {
                const p = h.result.props;
                const name = String(p.name ?? p.location ?? p.location_name ?? t('search.unnamed'));
                const sub = [
                  t(targetLabelKey(h.result.target)),
                  p.location ?? p.location_name,
                  p.village_a,
                  p.gov_a,
                ]
                  .filter(Boolean)
                  .join(' | ');
                const reason = reasonText(h);
                return (
                  // ARIA combobox pattern: focus stays in the search input (aria-activedescendant); its onKeyDown does the
                  // arrows / Enter / Escape, so the option is a pointer target only.
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <li
                    key={`${h.result.key}-${i}`}
                    id={`${uid}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onClick={() => pick(h)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex cursor-pointer items-start gap-3 border-b border-line px-4 py-2.5 last:border-0 ${i === active ? 'bg-brand-light/50' : ''}`}
                  >
                    <span aria-hidden className="text-lg">
                      {targetIcon(h.result.target)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-fg" dir="auto">
                        <Highlighted text={name} term={term} />
                      </span>
                      <span className="block truncate text-xs text-muted" dir="auto">
                        <Highlighted text={sub} term={term} />
                      </span>
                      {reason && <span className="block text-xs font-semibold text-brand-fg">{reason}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
