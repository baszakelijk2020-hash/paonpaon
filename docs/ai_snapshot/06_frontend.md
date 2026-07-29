# 06 — Frontend

**Snapshot date: 2026-07-29.**

## Application structure

Three Next.js 15 App Router apps under `apps/{admin,retailer,customer}`.

Shared presentation: `@paon/ui` (path exports) + each app’s `globals` import
of `packages/ui/src/styles/globals.css`.

## Routing (high level)

### Admin

- `(dashboard)/` — retailers, prospects/[id]/studio, inquiries, billing,
  analytics, ai-monitoring, demo-mode
- `login/`, `accept-invite/`, `auth/confirm`, `fonts/[filename]`, `api/*`

### Retailer

- `(dashboard)/` — dashboard, customers, products, collections, orders,
  alterations, appointments, loyalty, messages, notifications, events,
  wedding-parties, staff, analytics, settings
- Print routes outside dashboard for alterations/orders/appointments/events
- `login/`, `accept-invite/`

### Customer

- `(dashboard)/` — dashboard, account, orders, wishlist, appointments,
  alterations, loyalty, messages, notifications, events, wedding-parties
- `(marketing)/` — landing, pricing, founder, pilot, consultation,
  demo-request, discover/[topic]
- `r/[slug]/` — founder HTML storefront + nested React product/cart routes + APIs
- `demo/[token]/` — published prospect demo
- `login/` consumer lander (ADR-047)

## Component hierarchy

- **Portals:** `AppShell` / `AuthShell` from `@paon/ui` + app-local feature
  components colocated with routes
- **Storefront:** largely **not** React component tree — `paon-template.html`
  string served by Route Handler with injected JSON/data
- **Retailer theme:** `RetailerTheme` applies CSS variables from brand theme
  tokens (ADR-042)

## Shared UI (`@paon/ui`)

Components (path import): `Button`, `Badge`, `Input`, `Select`, `Label`,
`FormField`, `Card`, `ConfirmSubmitButton`, `DateTimePicker`,
`SearchableCollection`, `AppShell`, `AuthShell`, `RetailerTheme`, `cn`.

No barrel `index.ts` — import `@paon/ui/components/Button` style.

## Design system

Tokens in `packages/ui/src/styles/globals.css` (`@theme`): warm stone
palette, ink brand, radii, shadows, motion. Fonts OptimaKlein + GTBold3
via same-origin `/fonts/*` proxy routes. Docs: [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md),
[DESIGN_PORTS.md](../DESIGN_PORTS.md).

## State management

- Server Components fetch via repositories
- Client state: React local state / form state; **no** Redux/Zustand global store
  (NON_GOALS / ARCHITECTURE)
- Cart: persisted draft `Order` on server

## Forms

- Server Actions + `FormField` / native form elements
- Confirm destructive submits via `ConfirmSubmitButton`
- Validation: domain zod at action boundary

## Performance considerations (observed)

- Storefront HTML is large (`paon-template.html` historically ~16k lines per
  ADR-051) — served as document, not RSC tree
- Tailwind `@source` must include `@paon/ui` (ADR-037 fix)
- List UIs use client-side `SearchableCollection` filtering (not server search)
- Images: public Storage for product images (ADR-029)
