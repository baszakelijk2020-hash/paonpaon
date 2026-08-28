# Phase 20.25 — CTA 15px squircle contract: BLOCKED (real conformance gap)

- **Branch HEAD at this review:** `cdc72a9` (agent/claude-v3-review)
- **Owned path:** `apps/customer/e2e/customer-cta-squircle-v3.spec.ts` (not created — see below).

## Contract

`docs/plans/CUSTOMER_ENVIRONMENT_REBUILD_V3.md:50` / §3.1: "CTA controls use
one **15px** squircle system unless a card-specific instruction below says
otherwise." §6: "Book Appointment and TableService using 15px squircle
corners."

## What the release branch actually implements

The customer CTA/surface radius is **not one 15px system**. It is split:

| Surface                                  | Selector / rule                                              | Radius   | File                                                               |
| ---------------------------------------- | ------------------------------------------------------------ | -------- | ------------------------------------------------------------------ |
| Canonical CTA button                     | `.customer-button { border-radius: var(--customer-radius) }` | **12px** | `apps/customer/app/globals.css:65,124` (`--customer-radius: 12px`) |
| Canonical panels/cards                   | `.customer-panel`, `.customer-panel-dark`                    | **12px** | `apps/customer/app/globals.css:88-90` (same var)                   |
| Appointments inspiration cards           | inline `rounded-[15px]`                                      | 15px     | `apps/customer/app/(dashboard)/appointments/page.tsx:~180`         |
| Digital Fitting Room "Start creating"    | inline `rounded-[15px]`                                      | 15px     | `apps/customer/app/(dashboard)/digital-fitting-room/page.tsx`      |
| Orders Complete-the-Look source squircle | inline `rounded-[22px]`                                      | 22px     | `apps/customer/app/(dashboard)/orders/page.tsx`                    |
| Orders Complete-the-Look carousel items  | inline `rounded-[14px]`                                      | 14px     | `apps/customer/app/(dashboard)/orders/page.tsx`                    |

There is no shared `data-cta` / `.customer-cta` selector; primary CTAs use
ad-hoc inline `rounded-[..]` classes and the shared `.customer-button`
resolves to 12px.

## Why no spec was written

A faithful `customer-cta-squircle-v3.spec.ts` asserting "every customer CTA
computes `border-radius: 15px`" would **fail** on the release branch, because
the implementation genuinely does not conform (`--customer-radius` is 12px and
the Complete-the-Look radii are 22px/14px). Writing a spec that asserts only
the already-15px subset would be misleading (implying full conformance) and
weakening the assertion to pass is forbidden (AGENTS.md ch.54 / §33).

The fix — unifying the customer CTA system on 15px (`--customer-radius: 15px`
in `globals.css`, and reconciling the Complete-the-Look radii, or an explicit
card-specific carve-out in the contract) — touches
`apps/customer/app/globals.css` and customer UI implementation files, which
are out of this proof-repair lane's edit scope.

## Disposition

**20.25 stays unchecked.** Blocker: the "one 15px squircle" CTA system is not
implemented as one system (canonical `--customer-radius` is 12px). Needs the
customer-shell CSS/UI owner to unify it (or the founder to ratify the
per-surface radii as intentional card-specific exceptions), after which this
test-only proof can be authored.
