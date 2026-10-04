import clsx from 'clsx';
import KeywordSearch from './KeywordSearch';

interface Props {
  term: string;
  onCommit: (term: string) => void;
  /** Landing: a bar that slides in under the header once the hero's search has scrolled away. Results: always there. */
  floating?: boolean;
  visible?: boolean;
}

/** A slim search bar under the header, so the search is one glance away on a long page (7% of the screen, not 20%). */
export default function StickySearch({ term, onCommit, floating, visible = true }: Props) {
  return (
    <div
      inert={!visible}
      className={clsx(
        'z-30 border-b border-line bg-canvas/90 backdrop-blur',
        floating
          ? clsx('fixed inset-x-0 top-14 transition duration-300', visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0')
          : '-mx-4 sticky top-14',
      )}
    >
      <div className="mx-auto max-w-3xl px-4 py-2">
        <KeywordSearch value={term} onCommit={onCommit} />
      </div>
    </div>
  );
}
