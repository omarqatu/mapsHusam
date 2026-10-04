# House style digest (from `../pwa-1/clients/web`)

Read this instead of the reference repo. Open `../pwa-1/clients/web/src/components/ui/<X>.tsx` only
when mirroring one specific component. **Where this file and the reference disagree, this file wins**
(the reference has hard-coded Arabic strings, `axios`, `dir="rtl"` on single components, physical
Tailwind classes in places — we don't copy those).

## Layout (ours, `web/src/`)

```
api/          client.ts (fetch wrapper), queryClient.ts, one file per domain (auth.ts, users.ts …)
components/ui/  shared controls (below)          components/  app-level (AppShell, LanguageSwitcher)
features/<name>/  pages + feature-only components + hooks (map/, search/, admin-users/ …)
hooks/        cross-feature hooks (useDebounce, useAuth …)     store/  Zustand (auth, mapUi)
locales/      ar.json (default), en.json                       types/  shared types
```

## Rules taken from the reference

- Server state → TanStack Query (`useQuery`/`useMutation`, `invalidateQueries` on success).
  Never put API responses in Zustand. Zustand = auth + map UI only.
- Query defaults: `staleTime 2min`, `gcTime 10min`, `retry 1`, `refetchOnWindowFocus false`,
  mutations `retry 0`. Query keys come from factories per entity (`entity → list | detail | sub`).
  GeoJSON queries set `structuralSharing: false` (huge coordinate arrays).
- Local UI state (filters, selected row, modal open) → `useState`; lift only when shared.
- Types: interfaces for data shapes, co-located or in `types/`. No `any` (use `unknown` + guards).
- Icons: `lucide-react`, named imports. Styling: Tailwind only, no custom CSS files except the
  `@theme` tokens + a few globals in `index.css`. Reused class strings → a `const cardClass = '…'`.
- Direction is set once on `<html>` (`dir` + `lang`) from the i18n language; components never set `dir`.
- i18n: `useTranslation()`, keys in **both** `ar.json` and `en.json`; a test checks the two files have
  the same keys (reference: `i18nKeys.test.ts`). Language persisted in `localStorage` (`i18n-language`).
- Brand tokens are CSS variables on `:root` (`--color-primary`, `-hover`, `-light`, error/success/
  warning/info, `--bg-body`, `--bg-surface`) exposed to Tailwind via `@theme`; dark mode via
  `data-color-mode="dark"` on `<html>` (add later, not in Phase 0).

## Design system (ours — this part overrides the reference)

All visual decisions live in `web/src/index.css` (`@theme` + the dark block). Components use **semantic tokens only**; ESLint
rejects raw palette classes (`text-slate-600`, `bg-red-50` …) so a new screen cannot bypass them.

| Need | Use |
| --- | --- |
| Page / card / quiet block / stronger quiet block | `bg-canvas` / `bg-surface` / `bg-subtle` / `bg-subtle-2` |
| Borders, dividers / input borders | `border-line` / `border-line-strong` |
| Text | `text-fg` (primary), `text-muted` (secondary; never lighter) |
| Brand fill (white text) / brand text or icon / selected tint | `bg-brand` / `text-brand-fg` / `bg-brand-light` |
| Status (danger, warn, ok, info) | `text-{s}`, `bg-{s}-soft`, `border-{s}-line`, `bg-{s}-solid` (white text) |
| Elevation | `shadow-card` (rests) or `shadow-float` (menus, sheets) — nothing else |
| Radius | `rounded-lg` controls, `rounded-2xl` cards, `rounded-full` pills |
| Font | Cairo (self-hosted via `@fontsource-variable/cairo`), sizes: content ≥ 14 px, nothing below 12 px |

Dark mode: `data-theme="dark"` on `<html>` (toggle in the header, saved in `localStorage`, applied before paint by
`public/theme-init.js`); with no choice it follows the system. Status colours passed as data (road-status tones from config)
use `color-mix(in srgb, <colour> 12%, transparent)` for tints, never `${hex}15`. Icons are lucide; emoji are content
(service-type identity on the map), not UI chrome.

## Service registry — how to add a service type

`web/src/features/map/registry/services.ts` is the only list of service types. Everything else (layers on the map, search
targets, layer panel and type filter groups, category browser, search tags, editor fields, admin service picker) derives from it.

1. Add ONE entry to `DEFS` in `registry/services.ts`: `key` (= the `discriminator` in `service_all`), `icon` (emoji), `group`
   (one of `TYPE_GROUP_IDS` in `registry/types.ts`; `misc` if none fits), `tagName` + `tagKeywords` (Arabic search terms written
   to `search_tags` on save), optional `tier` (`always` / `medium`; omit = `close`, drawn only when zoomed in) and optional
   `editProfile` (`roadBarrier` / `fuelStation` for extra status columns; omit = the common service fields).
2. Add the display name in both `locales/ar.json` and `locales/en.json` under `services.<key>`.
3. Add the key to `ALLOWED_LAYERS` in `server.js` (the server whitelists layer names; a separate, reviewed commit).
4. Run `npm test`: `registry/registry.test.ts` fails with the exact place that disagrees (locale key missing, server whitelist,
   group, tags). Nothing else needs editing — do not add the key to any other list.

A new *group*: add its id to `TYPE_GROUP_IDS` (order = order of the filter), its icon in `registry/groupIcons.ts` (does not compile
without it) and `extras.featured.groups.<id>` in both locales. Long static data (legal texts, tag lists) lives in data files or
in the registry, never copied into components; legal texts are `features/legal/texts/<key>.json` (pinned by hash in `legal.content.test.ts`).

## Shared UI kit — API to mirror (`components/ui/`)

| Component | API (props) | Notes |
| --- | --- | --- |
| `Spinner`, `CenteredSpinner` | `size: sm\|md\|lg`; `minHeight` | Border-spinner, slate colours |
| `AlertMessage` | `type: error\|success\|warning\|info`, `message`, `onDismiss?`, `className?` | Renders nothing if `message` empty |
| `FormField` | `label`, `name`, `error?`, `required?`, `hint?`, `className?`, `children` | Label + reserved error slot (no layout jump); `hint` = small «i» marker with tooltip, not a paragraph |
| `TextInput` | native input props + `hasError?`, `leftIcon?`, `rightIcon?`, `onRightIconClick?`, `inputSize: sm\|md\|lg` | `forwardRef`; fixed heights h-9/h-11/h-[3.25rem] (use `start/end` icons, not left/right) |
| `SelectInput`, `TextareaInput`, `SearchInput` | same conventions | `SearchInput` is debounced |
| `Modal` | `open`, `onClose`, `children`, `maxWidthClass?='max-w-lg'` | Backdrop + centring only; no header/footer |
| `FormPanel` | header/body/footer chrome for a Modal | pair with `Modal` |
| `ConfirmDialog` | message-only confirm (title, message, confirm/cancel labels, tone) | for destructive actions |
| `PageHeader` | `title`, `description?`, `icon?`, `actions?`, `breadcrumb?`, `filters?`, `onClearFilters?`, `compact?` | White rounded-2xl card, title `text-2xl font-black text-slate-800` |
| `DataTable` | TanStack Table wrapper: columns via `createColumnHelper`, sorting, column filters, paging; `Badge` for statuses | 1k lines in the reference — start with a **small** version (sort + page + empty/loading), grow it |
| `StatCard`, `SectionCard`, `EmptyState` | title/value/icon; section wrapper | small |
| `StatusSelect`, `BooleanToggleSwitch`, `UserAvatar` | as named | port when a page needs them |

`ui/index.ts` re-exports everything (`export { default as X } from './X'`).

## Patterns for pages

- List page = `PageHeader` (title + actions + filters) → `DataTable` → `Modal`/`FormPanel` for
  create/edit → `ConfirmDialog` for delete. Every query has loading (`CenteredSpinner`), empty, and
  error (`AlertMessage`) states.
- Forms: small custom `useFormValidation(initialValues, validate)` returning
  `{ values, errors, handleChange, handleSubmit, isSubmitting }` (no react-hook-form).
- Permissions: one hook (`usePermissions`) — never inline role checks. Ours: role ∈ admin/provider/user
  from the auth store; UI-only, the server is the authority.
- Auth state lives in one store/hook; nothing else reads the token from `localStorage`.

## Tooling (mirror)

- `vite.config.ts` with `@vitejs/plugin-react` + `@tailwindcss/vite`; alias `@` → `src`.
- ESLint flat config (`@eslint/js`, `typescript-eslint` recommended, `react-hooks`, `react-refresh`);
  `no-explicit-any` warn, `no-unused-vars` warn with `^_` ignore. Vitest: jsdom, globals, `setupFiles`,
  `include: src/**/*.{test,spec}.{ts,tsx}`. tsconfig: `strict`, `verbatimModuleSyntax`,
  `erasableSyntaxOnly` (no enums / parameter properties — use unions and plain classes).
