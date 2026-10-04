import type { Role } from '@/types/auth';

/** `public` = anyone, `auth` = any logged-in user, or a list of allowed roles. UI gate only — the server is the authority. */
export type Access = 'public' | 'auth' | Role[];

export interface AppRoute {
  path: string;
  /** Key under `nav.*` in the locale files. */
  titleKey: string;
  access: Access;
  /** Legacy page this route replaces (shown on placeholders; deleted with the route switch). */
  legacy: string;
  /** Show in the header navigation. */
  nav?: boolean;
  /** Has its own full-screen layout and a real page (not rendered inside AppShell). */
  own?: boolean;
}

// Every route from docs/react-migration/PLAN.md. Replace `element` in App.tsx as pages are ported.
export const appRoutes: AppRoute[] = [
  { path: '/home', titleKey: 'nav.home', access: 'auth', legacy: '(new page — no legacy counterpart)', nav: true },
  { path: '/', titleKey: 'nav.map', access: 'public', legacy: 'index.html', nav: true, own: true },
  {
    path: '/add-listing',
    titleKey: 'nav.addListing',
    access: 'auth',
    legacy: '(new page — "add my business")',
  },
  { path: '/search', titleKey: 'nav.search', access: 'public', legacy: 'no-map-search.html', nav: true },
  {
    path: '/notifications',
    titleKey: 'nav.notifications',
    access: 'auth',
    legacy: 'notifications-panel.html',
  },
  {
    path: '/widgets/portal',
    titleKey: 'nav.widgets',
    access: 'public',
    legacy: 'widgets-portal.html',
    nav: true,
  },
  { path: '/widgets/ticker', titleKey: 'nav.widgets', access: 'public', legacy: 'widgets-ticker.html' },
  {
    path: '/admin/users',
    titleKey: 'nav.adminUsers',
    access: ['admin'],
    legacy: 'admin-users.html',
    nav: true,
  },
  {
    path: '/admin/users/:id/view',
    titleKey: 'nav.adminUsers',
    access: ['admin'],
    legacy: 'admin-view-user.html',
  },
  {
    path: '/admin/widgets',
    titleKey: 'nav.adminWidgets',
    access: ['admin'],
    legacy: 'widgets-admin.html',
    nav: true,
  },
  {
    path: '/admin/texts',
    titleKey: 'nav.adminTexts',
    access: ['admin'],
    legacy: 'texts-admin.html (Husam, main q2/q3)',
    nav: true,
  },
  {
    path: '/admin/visibility',
    titleKey: 'nav.adminVisibility',
    access: ['admin'],
    legacy: '(new page — replaces the hand-edited MAP_CONFIG.globalExclusions of legacy config.js)',
    nav: true,
  },
  {
    path: '/admin/appearance',
    titleKey: 'nav.adminAppearance',
    access: ['admin'],
    legacy: '(new page — mirrors the water platform Admin → Appearance)',
    nav: true,
  },
  {
    path: '/admin/contact',
    titleKey: 'nav.adminContact',
    access: ['admin'],
    legacy: "(new page — the platform's WhatsApp, phone, email and social pages; owner's point 6, 2026-10-04)",
    nav: true,
  },
  {
    path: '/admin/submissions',
    titleKey: 'nav.adminSubmissions',
    access: ['admin'],
    legacy:
      '(new page — approve or reject "add my business" requests; reached from the home card, not the header)',
  },
  {
    path: '/admin/dashboard',
    titleKey: 'nav.adminDashboard',
    access: ['admin'],
    legacy: 'dashboard.html',
    nav: true,
  },
];

export function canAccess(access: Access, role: Role | undefined): boolean {
  if (access === 'public') return true;
  if (!role) return false;
  return access === 'auth' || access.includes(role);
}
