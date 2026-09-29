import { useMemo, useState, type ReactNode } from 'react';
import { Bus, Coins, Flame, Fuel, Gem, Droplet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WidgetItem } from '@/api/adminWidgets';
import EmptyState from '@/components/ui/EmptyState';
import SearchInput from '@/components/ui/SearchInput';
import { CenteredSpinner } from '@/components/ui/Spinner';
import UpdatedAgo from '@/features/map/extras/UpdatedAgo';
import { currencyBadge, displayValue, filterRows, fuelKind, type PriceCardId } from '../model';
import GroupCard from './GroupCard';

/** Rows shown before "show all"; cards with more rows than this also get a search box. */
export const INITIAL_ROWS = 6;

const gemTone = 'bg-amber-100 text-amber-800';

const CARD: Record<PriceCardId, { icon: ReactNode; chip: string; searchKey: string }> = {
  currency: {
    icon: <Coins className="h-5 w-5" aria-hidden />,
    chip: 'bg-emerald-100 text-emerald-800',
    searchKey: 'widgets.search.name',
  },
  gold: { icon: <Gem className="h-5 w-5" aria-hidden />, chip: gemTone, searchKey: 'widgets.search.name' },
  fuel: {
    icon: <Fuel className="h-5 w-5" aria-hidden />,
    chip: 'bg-orange-100 text-orange-800',
    searchKey: 'widgets.search.name',
  },
  'transport-inter': {
    icon: <Bus className="h-5 w-5" aria-hidden />,
    chip: 'bg-indigo-100 text-indigo-800',
    searchKey: 'widgets.search.route',
  },
  'transport-intra': {
    icon: <Bus className="h-5 w-5" aria-hidden />,
    chip: 'bg-violet-100 text-violet-800',
    searchKey: 'widgets.search.route',
  },
};

/** The little tile at the start of a row: a currency code, a fuel drop / flame, a gem or a bus. */
function RowMark({ card, item, index }: { card: PriceCardId; item: WidgetItem; index: number }) {
  const cls = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black';
  const chip = CARD[card].chip;
  if (card === 'currency')
    return (
      <span className={`${cls} ${chip}`} dir="ltr" aria-hidden>
        {currencyBadge(item)}
      </span>
    );
  let icon: ReactNode = CARD[card].icon;
  if (card === 'fuel') {
    const kind = fuelKind(item);
    icon =
      kind === 'gas' ? (
        <Flame className="h-5 w-5" aria-hidden />
      ) : kind === 'diesel' ? (
        <Droplet className="h-5 w-5" aria-hidden />
      ) : (
        <Fuel className="h-5 w-5" aria-hidden />
      );
  }
  if (card === 'gold') {
    // Legacy alternated medals; the first three rows (24 / 21 / 18 carat) get a stronger tint.
    return (
      <span className={`${cls} ${index < 3 ? 'bg-amber-200 text-amber-900' : gemTone}`} aria-hidden>
        {icon}
      </span>
    );
  }
  return (
    <span className={`${cls} ${chip}`} aria-hidden>
      {icon}
    </span>
  );
}

interface PriceCardProps {
  card: PriceCardId;
  title: string;
  rows: WidgetItem[];
  /** Server stamp of the group (`updated_at`). */
  updatedAt: string | null;
  /** Reference time for the stamp (fetch time of the data). */
  now: number;
  loading: boolean;
  id: string;
  className?: string;
}

/** A hand-edited price list (currency, gold, fuel, fares): rows with value at the end, search when long, "show all". */
export default function PriceCard({
  card,
  title,
  rows,
  updatedAt,
  now,
  loading,
  id,
  className,
}: PriceCardProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const { icon, chip, searchKey } = CARD[card];
  const shown = useMemo(() => filterRows(rows, query), [rows, query]);
  const searching = query.trim() !== '';
  const visible = expanded || searching ? shown : shown.slice(0, INITIAL_ROWS);

  return (
    <GroupCard
      id={id}
      title={title}
      icon={icon}
      chip={chip}
      subtitle={<UpdatedAgo at={updatedAt} now={now} />}
      className={className}
    >
      {loading ? (
        <CenteredSpinner minHeight="8rem" />
      ) : rows.length === 0 ? (
        <EmptyState title={t('widgets.empty')} />
      ) : (
        <>
          {rows.length > INITIAL_ROWS && (
            <SearchInput value={query} onChange={setQuery} debounceMs={150} placeholder={t(searchKey)} />
          )}
          {shown.length === 0 ? (
            <p className="py-6 text-center text-base text-slate-600">{t('widgets.noMatch')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((item, i) => (
                <li key={`${item.id ?? ''}-${i}`} className="flex items-center gap-3 py-2.5">
                  <RowMark card={card} item={item} index={i} />
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-base font-semibold text-slate-800" dir="auto">
                      {item.label || item.id}
                    </div>
                    {(card === 'currency' ? item.code : item.unit) && (
                      <div className="text-sm text-slate-600" dir="auto">
                        {card === 'currency' ? item.code : item.unit}
                      </div>
                    )}
                  </div>
                  <div
                    className="max-w-[45%] break-words text-end text-lg font-black tabular-nums text-slate-900"
                    dir="auto"
                  >
                    {displayValue(item.value) || '—'}
                    {card === 'currency' && item.unit && (
                      <span className="ms-1 text-sm font-semibold text-slate-600">{item.unit}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!searching && shown.length > INITIAL_ROWS && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-brand hover:bg-slate-50"
            >
              {expanded ? t('common.showLess') : t('common.showAll', { count: shown.length })}
            </button>
          )}
        </>
      )}
    </GroupCard>
  );
}
