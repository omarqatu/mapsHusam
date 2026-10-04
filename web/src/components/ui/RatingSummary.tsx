import { useTranslation } from 'react-i18next';
import { intlLocale } from '@/lib/format';
import StarRating from './StarRating';

/** Stars out of five, the number beside them and (when known) how many ratings it is made of: ★★★★☆ 4.5 (12). */
export default function RatingSummary({ value, count, className }: { value: number; count?: number; className?: string }) {
  const { i18n } = useTranslation();
  const n = Math.min(5, Math.max(0, value));
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <StarRating value={n} className="[&_svg]:h-3.5 [&_svg]:w-3.5" />
      <span className="font-bold text-fg tabular-nums">
        {n.toLocaleString(intlLocale(i18n.language), { maximumFractionDigits: 1 })}
      </span>
      {count !== undefined && <span className="text-muted tabular-nums">({count})</span>}
    </span>
  );
}
