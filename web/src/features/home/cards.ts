import {
  Bell,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  Map as MapIcon,
  PlusCircle,
  Store,
  Radio,
  Search,
  SlidersHorizontal,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types/auth';
import type { ChipTone } from './tones';

export type CardId =
  | 'map'
  | 'search'
  | 'live'
  | 'requests'
  | 'notifications'
  | 'service'
  | 'users'
  | 'dashboard'
  | 'widgets'
  | 'addListing'
  | 'myListings'
  | 'submissions';

export interface CardDef {
  id: CardId;
  icon: LucideIcon;
  tone: ChipTone;
  /** A page link; without it the card runs an action (opens a dialog or the provider panel). */
  to?: string;
  /** Roles that see the card; everyone signed in when absent. */
  roles?: Role[];
}

/** The entrances, in the order they are shown. Adding one = a row here + `home.cards.<id>` in both locale files. */
export const CARDS: CardDef[] = [
  { id: 'map', icon: MapIcon, tone: 'brand', to: '/' },
  { id: 'search', icon: Search, tone: 'info', to: '/search' },
  { id: 'live', icon: Radio, tone: 'warn', to: '/widgets/portal' },
  { id: 'requests', icon: ClipboardList, tone: 'ok' },
  { id: 'myListings', icon: Store, tone: 'ok', to: '/my-listings', roles: ['provider'] },
  { id: 'service', icon: Wrench, tone: 'brand', roles: ['provider'] },
  { id: 'addListing', icon: PlusCircle, tone: 'ok', to: '/add-listing', roles: ['user'] },
  { id: 'notifications', icon: Bell, tone: 'info', to: '/notifications' },
  { id: 'users', icon: Users, tone: 'brand', to: '/admin/users', roles: ['admin'] },
  { id: 'submissions', icon: Inbox, tone: 'warn', to: '/admin/submissions', roles: ['admin'] },
  { id: 'dashboard', icon: LayoutDashboard, tone: 'info', to: '/admin/dashboard', roles: ['admin'] },
  { id: 'widgets', icon: SlidersHorizontal, tone: 'warn', to: '/admin/widgets', roles: ['admin'] },
];

/** The cards this role sees. */
export const cardsFor = (role: Role) => CARDS.filter((c) => !c.roles || c.roles.includes(role));
