/** Structured form of the legacy HTML legal/help texts (see `content.ts`). No raw HTML anywhere. */

export type LegalKey =
  | 'guide'
  | 'guideSearch'
  | 'guideProvider'
  | 'guideSubscription'
  | 'guideMapInteractive'
  | 'about'
  | 'terms'
  | 'privacy'
  | 'contact';

export type LegalTone = 'blue' | 'yellow' | 'green' | 'gray' | 'cyan';
export type LegalIconName = 'info' | 'external' | 'list' | 'video' | 'facebook';
/** Icon on a card's coloured badge (the guide's steps). */
export type LegalCardIcon = 'search' | 'map' | 'phone' | 'share' | 'live' | 'add' | 'user' | 'install' | 'star';
export type LegalTitleIcon =
  'book' | 'search' | 'provider' | 'userPlus' | 'map' | 'info' | 'terms' | 'privacy' | 'mail';

/** Text with emphasis, icons and links. Links are `https://…` or an in-app route starting with `/`. */
export type LegalInline =
  string | { strong: string } | { icon: LegalIconName } | { link: string; text: string };

export interface LegalCard {
  kind: 'card';
  /** Border colour of the card (hex); with `icon`, the colour of the icon's badge instead. */
  accent: string;
  icon?: LegalCardIcon;
  title: string;
  text: LegalInline[];
  action?: { href: string; text: string; icon?: LegalIconName };
}
export interface LegalCallout {
  kind: 'callout';
  tone: LegalTone;
  text: LegalInline[];
}
export type LegalPanelBody =
  | { kind: 'text'; text: LegalInline[] }
  | { kind: 'list'; items: LegalInline[][] }
  | { kind: 'stats'; items: { value: string; label: string }[] }
  | { kind: 'button'; href: string; text: string; icon?: LegalIconName };

export type LegalBlock =
  | { kind: 'title'; title: string; subtitle: string }
  | { kind: 'intro'; text: LegalInline[] }
  | LegalCallout
  | { kind: 'cards'; items: (LegalCard | LegalCallout)[] }
  | { kind: 'panel'; tone: LegalTone; title: string; body: LegalPanelBody[] };

export interface LegalDoc {
  title: string;
  icon: LegalTitleIcon;
  blocks: LegalBlock[];
}
