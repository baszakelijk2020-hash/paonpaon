# Engineering Principles

These are the standing rules for every change made to this repository,
by anyone or anything (including AI assistance — see the root
[CLAUDE.md](../CLAUDE.md)). When a request conflicts with these
principles, the principles win; raise the conflict rather than working
around it silently.

## Priority order

**Correct > Reliable > Scalable > Consistent > Fast to build.**

We do not trade correctness for velocity. A fast-but-wrong
implementation costs more than the time it saved, the first time it's
debugged in production against real retailer data.

## Mobile first

Every UI is designed and implemented for the smallest supported
viewport first, then enhanced upward. See
[UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md).

## Component-driven, feature-based

UI is composed from `@paon/ui` primitives and app-local feature
components, organized by feature/domain area within each app
(`app/(retailer)/customers/...`), not by technical layer
(`components/`, `hooks/`, `utils/` dumping grounds). A feature's code
lives together.

## Domain-driven

Business logic and business language live in `@paon/domain`, organized
by bounded context ([DOMAIN_MODEL.md](./DOMAIN_MODEL.md)). UI code talks
about `Order` and `ProductionOrder`, never about a raw database row
shape. If the product uses a term (alteration, clienteling, referral),
the code uses that exact term — no quiet renaming to whatever a past
engineer's local convention was.

## Strong typing, no escape hatches

`strict` TypeScript everywhere. `any` is an ESLint error
(`@typescript-eslint/no-explicit-any`), not a warning. Branded IDs
(`CustomerId`, `RetailerId`, ...) are used at every boundary that
handles multiple entity types, specifically to make cross-tenant and
cross-entity mistakes fail to compile. If a type feels awkward to
express correctly, that is signal to model the domain more precisely,
not to reach for `any` or a type assertion.

## Maximum reuse, zero duplicated logic

If a rule, calculation or piece of UI is needed in two places, it is
built once in `packages/*` and imported twice — never copy-pasted and
allowed to drift. Before writing new logic, check whether
`@paon/domain`, `@paon/database`, `@paon/auth`, `@paon/ui` or
`@paon/utils` already has it, or should own it.

## Understand before you modify

Before changing existing code, read enough of the surrounding
architecture (this document set, then the code) to know why it's
shaped the way it is. A refactor that "simplifies" code without
understanding the constraint it was satisfying is a regression, not an
improvement.

## Never knowingly introduce technical debt

If a shortcut is taken under real time pressure, it is written down —
in [DECISIONS.md](./DECISIONS.md) if it's architectural, or as a
tracked follow-up otherwise — not left silent for a future engineer to
discover the hard way. Silent debt is the one thing this codebase
cannot accumulate and still hold together over years.

## Always leave the repository working

Every change lands with lint, typecheck, tests and build all green.
"I'll fix it in a follow-up" is not an acceptable state to merge in.

## Accessibility and performance are requirements, not polish

Both are checked as part of normal development (lint rules, Core Web
Vitals attention in the design system's motion/loading conventions),
not addressed in a later pass.
