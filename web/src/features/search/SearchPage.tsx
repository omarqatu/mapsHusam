import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { StatusLayer } from '@/api/liveStatus';
import type { MapTarget } from '../map/targets';
import CategoryBrowser from './CategoryBrowser';
import CategoryResults from './CategoryResults';
import { isGroupId, singleTargetOf, type GroupId } from './categories';
import LandingSections from './LandingSections';
import LiveLinks from './LiveLinks';
import KeywordResults from './KeywordResults';
import Collections from './Collections';
import SearchHero from './SearchHero';
import StickySearch from './StickySearch';
import { KEYWORD_MIN_CHARS } from './queries';
import { readSelection, writeSelection, type Selection } from './selection';
import StatusDialog from './StatusDialog';
import TickerBar from '../widgets/components/TickerBar';
import { useSectionShown } from '@/features/visibility/store';
import TodayStrip from './TodayStrip';

/**
 * Search without a map (legacy no-map-search.html). What is shown is decided by the URL:
 * `?q=` keyword results · a chosen type (`?type=` / `?resultsShare=`) with filters · otherwise the category browser and
 * the featured sections. `?group=` picks a group tab (a group with a single type opens it).
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<StatusLayer | null>(null);
  const featuredOn = useSectionShown('featured'); // the featured / top-rated rows of the landing
  const tickerOn = useSectionShown('ticker');

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
  const landing = !keywordActive && !selection;

  // The slim search bar slides in once the hero's own search has scrolled under the header.
  const heroSearch = useRef<HTMLDivElement>(null);
  const [heroGone, setHeroGone] = useState(false);
  useEffect(() => {
    const el = heroSearch.current;
    if (!landing || !el) return;
    const io = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting), { rootMargin: '-56px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [landing]);

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
    <div className="space-y-5">
      {landing ? (
        <>
          <StickySearch term={term} onCommit={commitKeyword} floating visible={heroGone} />
          <SearchHero term={term} onCommit={commitKeyword} onPick={openTarget} searchRef={heroSearch} />
          <LiveLinks onRoads={() => setStatus('road_barriers')} onFuel={() => setStatus('fuel_stations')} />
          {/* The same live data as the ticker: it follows the same switch. */}
          {tickerOn && <TodayStrip />}
          {group === 'all' ? (
            <Collections onGroup={pickGroup} onPick={openTarget} />
          ) : (
            <CategoryBrowser group={group} onGroup={pickGroup} onPick={openTarget} />
          )}
          {featuredOn && <LandingSections />}
        </>
      ) : (
        <>
          <StickySearch term={term} onCommit={commitKeyword} />
          {keywordActive ? (
            <KeywordResults term={term} />
          ) : (
            selection && (
              <CategoryResults
                key={`${selection.target.kind}:${JSON.stringify(selection.target)}`}
                selection={selection}
                onChange={changeSelection}
                onBack={back}
              />
            )
          )}
        </>
      )}

      <StatusDialog layer={status} onClose={() => setStatus(null)} />
      {/* Legacy footer bar: the live-information ticker (each item opens the information centre at its card). */}
      <TickerBar className="rounded-xl border" />
    </div>
  );
}
