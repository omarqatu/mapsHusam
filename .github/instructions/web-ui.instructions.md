---
applyTo: "web/src/**/*.{ts,tsx}"
---
# React code in `web/src`

- Layout is feature-first: `api/<domain>.ts` (typed calls through `client.ts`), `features/<feature>/` (hooks, components,
  `<Feature>Page.tsx`), shared pieces in `components/ui/`.
- Server data goes through TanStack Query (`queryKey: ['<domain>', ...args]`); mutations invalidate the matching keys.
  Client-only UI state is local state or a Zustand store. Never put server data in Zustand.
- Legacy `window.x = ...` globals become props, hooks or a store; never attach to `window`.
- Text through `t('...')` with the key added to both `locales/ar.json` and `locales/en.json`. Delete keys you stop using
  (`i18nKeys.test.ts` guards this).
- Logical Tailwind classes only; direction-sensitive icons get `rtl:rotate-*`.
- Icons come from `lucide-react`; a type's icon is registered once in `features/map/registry/typeIcons.ts` and no two
  types or a type and its group share one.
- Cards: `search/ListingCard` is the compact teaser, the map's `FeaturedCard` is the full detail card; do not invent a
  third. Media go through `components/ui/MediaGallery` and `MediaViewer`.
- A non-trivial hook or util gets a Vitest test next to it.
