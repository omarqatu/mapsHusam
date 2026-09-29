import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { StatusLayer } from '@/api/liveStatus';
import { FeaturedSections } from '../map/extras/FeaturedTab';
import type { MapTarget } from '../map/targets';
import CategoryBrowser from './CategoryBrowser';
import CategoryResults from './CategoryResults';
import { isGroupId, singleTargetOf, type GroupId } from './categories';
import Hero from './Hero';
import QuickActions from './QuickActions';
import KeywordResults from './KeywordResults';
import KeywordSearch from './KeywordSearch';
import PageFooter from './PageFooter';
import { KEYWORD_MIN_CHARS } from './queries';
import { readSelection, writeSelection, type Selection } from './selection';
import StatusDialog from './StatusDialog';

/**
 * Search without a map (legacy no-map-search.html). What is shown is decided by the URL:
 * `?q=` keyword results · a chosen type (`?type=` / `?resultsShare=`) with filters · otherwise the category browser and
 * the featured sections. `?group=` picks a group tab (a group with a single type opens it).
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<StatusLayer | null>(null);

  const term = (params.get('q') ?? '').trim();
  const groupParam = params.get('group');
  const group: GroupId = isGroupId(groupParam) ? groupParam : 'all';
  const explicit = useMemo(() => readSelection(params), [params]);
  // A deep link to a one-type group (?group=fuel) opens that type at once, like the legacy tab did.
  const selection: Selection | null = useMemo(() => {
    if (explicit) return explicit;
    const single = singleTargetOf(group);
    return single ? { target: single, conditions: [] } : null;
  }, [explicit, group]);

  const keywordActive = term.length >= KEYWORD_MIN_CHARS;

  const commitKeyword = useCallback(
    (next: string) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (next) n.set('q', next);
          else n.delete('q');
          return n;
        },
        { replace: true },
      ),
    [setParams],
  );

  const openTarget = (target: MapTarget) => setParams(writeSelection(params, { target, conditions: [] }));
  const changeSelection = (next: Selection) => setParams(writeSelection(params, next), { replace: true });
  const back = () => {
    const n = writeSelection(params, null);
    n.delete('group');
    setParams(n);
  };
  const pickGroup = (g: GroupId) => {
    const n = new URLSearchParams(params);
    if (g === 'all') n.delete('group');
    else n.set('group', g);
    setParams(singleTargetOf(g) ? writeSelection(n, { target: singleTargetOf(g)!, conditions: [] }) : n, {
      replace: !singleTargetOf(g),
    });
  };

  return (
    <div className="space-y-6">
      {/* Stays in view while scrolling: the search box and the three shortcuts are what people come back to. */}
      <div className="sticky top-14 z-30 -mx-4 space-y-2 bg-[#f3f6f9]/95 px-4 py-2 backdrop-blur">
        <KeywordSearch value={term} onCommit={commitKeyword} />
        <QuickActions onRoads={() => setStatus('road_barriers')} onFuel={() => setStatus('fuel_stations')} />
      </div>
      {!keywordActive && !selection && <Hero />}

      {keywordActive ? (
        <KeywordResults term={term} />
      ) : selection ? (
        <CategoryResults
          key={`${selection.target.kind}:${JSON.stringify(selection.target)}`}
          selection={selection}
          onChange={changeSelection}
          onBack={back}
        />
      ) : (
        <>
          <CategoryBrowser group={group} onGroup={pickGroup} onPick={openTarget} />
          <div className="space-y-4">
            <FeaturedSections grid />
          </div>
        </>
      )}

      <StatusDialog layer={status} onClose={() => setStatus(null)} />
      <PageFooter />
    </div>
  );
}
