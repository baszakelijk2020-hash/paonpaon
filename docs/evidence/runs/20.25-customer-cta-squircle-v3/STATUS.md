# Phase 20.25 — CTA 15px squircle contract: RESOLVED

- **Product fix SHA:** `784e08c` — `fix(customer): unify CTA controls on the
15px squircle system (phase-20.25)`.
- **Proof SHA:** this commit (adds `customer-cta-squircle-v3.spec.ts` + screenshots).
- **Owned paths:** `apps/customer/e2e/customer-cta-squircle-v3.spec.ts`,
  `docs/evidence/runs/20.25-customer-cta-squircle-v3/`.

## Contract

`docs/plans/CUSTOMER_ENVIRONMENT_REBUILD_V3.md:50` / §3: "CTA controls use one
**15px** squircle system unless a card-specific instruction below says
otherwise." §2: "Book Appointment and TableService using 15px squircle
corners."

## The gap that was fixed

Customer action buttons rendered at two non-conforming radii:

| Surface                        | Rule                                           | Was      | Now      |
| ------------------------------ | ---------------------------------------------- | -------- | -------- |
| `.customer-button` (canonical) | `border-radius: var(--customer-radius)` = 12px | **12px** | **15px** |
| `@paon/ui` `Button` CTAs       | `rounded-[var(--radius-md)]` = 8px             | **8px**  | **15px** |

### Change (SHA `784e08c`, `apps/customer` only)

- `apps/customer/app/globals.css`: added `--customer-cta-radius: 15px`;
  `.customer-button` now uses it. `--customer-radius` (panels, inputs, list
  rows) is deliberately left at 12px — only action controls moved.
- Added `rounded-[15px]` (via `cn(...)` / `@paon/ui` `Button` `className`, so
  `tailwind-merge` overrides the base radius) to the customer CTA call sites:
  product-detail **Add to cart** + **Save to wishlist**; MorningRoutine
  **Save / Mark reviewed / Ask advisor / Book / Buy**; messages
  **Book Appointment**; appointment booking **Confirm**; 1-Tap Checkout
  **Turn it on** (was an explicit `rounded-[12px]`) + **Save & turn on**;
  cart **Book an appointment / Save pending order / Book appointment**.

No shared `@paon/ui`, storefront layout, auth, RLS, migration, Supabase,
payment, QR, email, receipt, Mission Control, or PHASE.md changes.

## Out of scope (not a CTA regression)

Image-card corner radii called out in the earlier review — Orders
Complete-the-Look source `rounded-[22px]` / carousel `rounded-[14px]`,
Appointments inspiration cards `rounded-[15px]` — are card surfaces, not
Buy/Save/Book action controls, and are governed by the contract's card-corner
rules (§ "15px card corners"), not the CTA-system rule. They are left
untouched by this lane.

## Proof

`apps/customer/e2e/customer-cta-squircle-v3.spec.ts` — authenticated customer
(magic-link), desktop `1512x982` + mobile `390x844`:

- MorningRoutine action row: **Save, Mark reviewed, Ask advisor, Book, Buy**
  each compute `border-radius: 15px`.
- Every `.customer-button` reached in the journey (`/morning-routine`,
  `/appointments`, `/dashboard`) computes `15px` — never 8px / 12px.
- Product detail: **Add to cart**, **Save to wishlist** compute `15px`;
  DFR **Start creating** (already 15px) is the positive control.
- No page/script console errors (pre-existing legacy-route React #418 and
  asset 404/503 noise are filtered with documented rationale).

Result: **2 passed** (`pnpm exec playwright test customer-cta-squircle-v3`).

Screenshots: `desktop-morning-routine-1512x982.png`,
`desktop-product-1512x982.png`, `mobile-morning-routine-390x844.png`,
`mobile-product-390x844.png`.

Verification: `pnpm --filter @paon/customer lint`,
`pnpm --filter @paon/customer typecheck` — both clean.
