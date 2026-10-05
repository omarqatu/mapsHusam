import { createElement } from 'react';
import { targetIconComponent } from './registry/typeIcons';
import type { MapTarget } from './targets';

/**
 * The icon of a property kind or service type, as a drawing from the icon library (never an emoji). It is as big as the text
 * around it (`1em`, so a `text-3xl` wrapper makes it large); pass a class for a fixed size or colour.
 */
export default function TargetIcon({ target, className = 'h-[1em] w-[1em] shrink-0' }: { target: MapTarget | null | undefined; className?: string }) {
  return createElement(targetIconComponent(target), { className, 'aria-hidden': true });
}
