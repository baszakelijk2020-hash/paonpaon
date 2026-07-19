# UX Philosophy

Design system tokens and components ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md))
are the vocabulary. This document is the grammar — how PAON's three
apps should feel to use, independent of any one screen.

## Three audiences, three postures

- **PAON Admin** is a console for experts who use it daily. Optimize
  for density and speed over hand-holding: real tables, keyboard-
  friendly, minimal confirmation dialogs for reversible actions.
- **Retailer Portal** is a console for retail staff who are often
  mid-conversation with a customer while using it. Optimize for
  glanceable status and fast task completion — a sales associate should
  never need more than a couple of taps to check an order's production
  status while a client is standing in front of them.
- **Customer Portal** is a relationship, not a dashboard. Optimize for
  warmth and clarity over feature density — a customer opening it
  should feel looked after, not asked to configure something.

## Core rules

1. **Status is always legible without a click.** Order, production and
   alteration status ([PRODUCT.md](./PRODUCT.md)) are shown as plain
   language and visual state, never as an internal enum a customer has
   to interpret.
2. **Never make the customer re-explain themselves.** If a preference,
   garment-specific fitting observation or note was captured once (`CustomerPreferences`,
   `ClientelingNote`), every surface that could use it does, without
   the customer or staff member re-entering it.
3. **Performance is a UX requirement, not an engineering nice-to-have.**
   Server Components and streaming are the default specifically so a
   slow data source degrades one section of a page, not the whole
   interaction. A page that blocks on the slowest query is a UX defect.
4. **Restraint over cleverness.** No feature ships with three ways to do
   the same thing. One clear path per task, matching the design
   system's "quiet, editorial" visual language with an equally quiet
   interaction language — minimal modals, minimal interruptive
   notifications, no dark patterns (no fake urgency, no pre-checked
   marketing opt-ins).
5. **Empty and loading states are designed, not defaulted.** A spinner
   or a blank table is a failure to design the state, not a placeholder
   that's acceptable until "later."
6. **Mobile-first everywhere**, per [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
   — including the Retailer Portal, which staff frequently use on a
   tablet or phone on the sales floor, not only at a desk.

## Accessibility is part of the brand

A luxury brand that is inaccessible to a customer with a disability has
failed at the thing luxury is supposed to mean: being genuinely well
taken care of. AA compliance ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)) is
non-negotiable, not a backlog item.
