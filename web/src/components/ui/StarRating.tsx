import { useState } from 'react';
import clsx from 'clsx';
import { Star } from 'lucide-react';

interface StarRatingProps {
  /** 0-5 (an average is rounded to whole stars for display). */
  value: number;
  /** Given: the stars are buttons and the user picks 1-5. Absent: display only. */
  onChange?: (value: number) => void;
  /** Accessible name of the whole control (e.g. "Rating"). */
  label?: string;
  size?: 'sm' | 'lg';
  className?: string;
}

/** Five stars, read-only (averages, comments) or a picker (rating a service). */
export default function StarRating({ value, onChange, label, size = 'sm', className }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const shown = onChange && hover ? hover : Math.round(value);
  const icon = size === 'lg' ? 'h-8 w-8' : 'h-4 w-4';

  if (!onChange)
    return (
      <span
        className={clsx('inline-flex text-warn', className)}
        role="img"
        aria-label={`${label ?? ''} ${value}/5`.trim()}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={icon} fill={n <= shown ? 'currentColor' : 'none'} aria-hidden />
        ))}
      </span>
    );

  return (
    <div role="radiogroup" aria-label={label} className={clsx('inline-flex text-warn', className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}/5`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-brand"
        >
          <Star className={icon} fill={n <= shown ? 'currentColor' : 'none'} aria-hidden />
        </button>
      ))}
    </div>
  );
}
