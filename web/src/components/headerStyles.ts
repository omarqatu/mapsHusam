import { useCurrentTheme } from '@/features/brand-theme/store';
import type { HeaderStyle } from '@/features/brand-theme/model';

/** The classes of every top-bar part, per header style (chosen by the admin; all follow the brand colours). */
export interface HeaderTone {
  bar: string;
  /** The bar on the map: see-through over the imagery. */
  glass: string;
  mark: string;
  group: string;
  tabOn: string;
  tabOff: string;
  iconBtn: string;
  accountBtn: string;
  avatar: string;
  name: string;
  chevron: string;
  login: string;
  /** Ring that cuts a badge out of the bar behind it. */
  badgeRing: string;
}

const iconBase = 'relative inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors';
const brandMark = 'bg-gradient-to-br from-brand to-brand-2 text-white shadow-card';
const brandLogin = 'bg-brand text-white hover:bg-brand-hover';
const glass = 'backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_14px_rgb(0_0_0/0.14)]';

export const HEADER_TONES: Record<HeaderStyle, HeaderTone> = {
  // A light wash of the brand colour: calm on long pages, the brand still reads.
  soft: {
    bar: 'border-b border-brand/15 bg-gradient-to-l from-brand-light to-surface text-fg',
    glass: `border-b border-brand/15 bg-gradient-to-l from-brand-light/80 to-surface/65 text-fg ${glass}`,
    mark: brandMark,
    group: 'bg-surface/70 ring-1 ring-brand/10',
    tabOn: 'bg-brand text-white shadow-card',
    tabOff: 'text-muted hover:bg-brand-light hover:text-brand-fg',
    iconBtn: `${iconBase} text-brand-fg hover:bg-brand/10 aria-expanded:bg-brand/15`,
    accountBtn: 'hover:bg-brand/10 aria-expanded:bg-brand/15',
    avatar: `${brandMark} ring-2 ring-surface`,
    name: 'text-fg',
    chevron: 'text-muted',
    login: brandLogin,
    badgeRing: 'ring-surface',
  },
  gradient: {
    bar: 'bg-gradient-to-l from-brand to-brand-2 text-white shadow-card',
    glass: `bg-gradient-to-l from-brand/85 to-brand-2/85 text-white ${glass}`,
    mark: 'bg-white/15 text-white ring-1 ring-white/25',
    group: 'bg-black/10',
    tabOn: 'bg-white text-brand shadow-card',
    tabOff: 'text-white/85 hover:bg-white/10 hover:text-white',
    iconBtn: `${iconBase} text-white/85 hover:bg-white/15 hover:text-white aria-expanded:bg-white/20 aria-expanded:text-white`,
    accountBtn: 'hover:bg-white/15 aria-expanded:bg-white/20',
    avatar: 'bg-white text-brand shadow-card ring-2 ring-white/50',
    name: 'text-white',
    chevron: 'text-white/75',
    login: 'bg-white text-brand hover:bg-white/90',
    badgeRing: 'ring-brand',
  },
  surface: {
    bar: 'border-b border-line bg-surface/90 text-fg backdrop-blur-md',
    glass: `border-b border-line/50 bg-surface/50 text-fg ${glass}`,
    mark: brandMark,
    group: 'bg-subtle',
    tabOn: 'bg-surface text-brand-fg shadow-card',
    tabOff: 'text-muted hover:text-fg',
    iconBtn: `${iconBase} text-muted hover:bg-subtle hover:text-fg aria-expanded:bg-subtle aria-expanded:text-fg`,
    accountBtn: 'hover:bg-subtle aria-expanded:bg-subtle',
    avatar: `${brandMark} ring-2 ring-brand-light`,
    name: 'text-fg',
    chevron: 'text-muted',
    login: brandLogin,
    badgeRing: 'ring-surface',
  },
};

/** The tone of the bar in effect (follows the admin's live preview too). */
export function useHeaderTone(): HeaderTone {
  return HEADER_TONES[useCurrentTheme().header];
}
