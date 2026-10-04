import type { CSSProperties } from 'react';
import { MapPin } from 'lucide-react';

/** Pins scattered along the edges (never behind the text), each bobbing on its own beat. Hidden on phones. */
const PINS: { style: CSSProperties; size: string }[] = [
  { style: { insetInlineStart: '7%', top: '22%', animationDelay: '0s' }, size: 'h-11 w-11' },
  { style: { insetInlineStart: '14%', bottom: '18%', animationDelay: '1.2s' }, size: 'h-8 w-8' },
  { style: { insetInlineEnd: '8%', top: '30%', animationDelay: '0.6s' }, size: 'h-9 w-9' },
  { style: { insetInlineEnd: '15%', bottom: '14%', animationDelay: '1.8s' }, size: 'h-12 w-12' },
];

/**
 * The hero's background: a faint dotted map grid fading at the edges, two blurred brand-colour fields drifting slowly,
 * and a few pins — the "map" identity as calm motion, no photo. Everything stands still with "reduce motion".
 */
export default function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-1/3 start-[-10%] h-[28rem] w-[28rem] rounded-full bg-brand/15 blur-3xl motion-safe:animate-[drift_22s_ease-in-out_infinite]" />
      <div className="absolute -bottom-1/3 end-[-8%] h-[26rem] w-[26rem] rounded-full bg-brand-2/15 blur-3xl motion-safe:animate-[drift_26s_ease-in-out_infinite_reverse]" />
      <svg className="absolute inset-0 h-full w-full text-brand/25 [mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_75%)]">
        <defs>
          <pattern id="hero-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.3" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dots)" />
      </svg>
      {PINS.map((p, i) => (
        <span
          key={i}
          style={p.style}
          className={`absolute hidden items-center justify-center rounded-full bg-surface text-brand-fg shadow-float ring-1 ring-line md:flex motion-safe:animate-[bob_4.5s_ease-in-out_infinite] ${p.size}`}
        >
          <MapPin className="h-1/2 w-1/2" />
        </span>
      ))}
    </div>
  );
}
