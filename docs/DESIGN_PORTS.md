# Design Ports

Inventory of founder-designed surfaces and their porting status. **Tier 1 —
read this before touching any of them.** The governing rule is ADR-052 and
the porting rule in [../CLAUDE.md](../CLAUDE.md).

For the product job, actors, module/tier, state, data/events, privacy,
integration, recovery and connected proof contract behind each surface, read
[FOUNDER_TOOL_BLUEPRINTS.md](./FOUNDER_TOOL_BLUEPRINTS.md). This file remains
the concise source-fidelity status; the blueprint is the build contract.

## The rule, in one line

Preserve the source composition, CSS, markup, motion and interaction; wire
real PAON data and actions through the narrowest hook. Never replace a
designated tool with a generic Tailwind or `@paon/ui` interpretation.

ADR-071 adds the completion rule: visual fidelity alone is a shell, while a
domain/repository implementation without the source experience is a
foundation. A tool is built only when both are connected and proven.

## Where the sources live

All committed to this repository already — no session needs to ask for
them, and no session has an excuse for approximating them.

| Source                                          | Contains                                                                                                                                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/customer/app/r/[slug]/paon-template.html` | The storefront — the retailer's digital front door                                                                                                                                                                               |
| `downloaded_pages/pag1.html`                    | Voice/drag fitting, QR try-on/fabric batch, first-fitting automation, silhouette analysis, Mission Control/Self-Portrait, MorningRoutine, lapel configurator, swipe, TableService, Inspiration Box, globe, Merchant and training |
| `downloaded_pages/pag2.html`                    | Moonstruck; PAON's designated scope is the groom/best-men inspiration, invitation, personal-profile, group-date, fitting, delivery and pickup planner                                                                            |
| `downloaded_pages/pag3.html`                    | Residents Club context; PAON's designated scope is Preferred Tailoring's weekly calendar-led wardrobe orchestration and the HighMaintenance care workflow                                                                        |

`pag1`–`pag3` were written as a commercial recommendation to a supplier
that PAON is now independent of (see `NORTH_STAR.md`). They survive purely
as design specification.

## Status vocabulary

- **Faithful foundation:** source experience is substantially preserved and
  real state is connected, but connected visual/browser proof or part of the
  required workflow is missing.
- **Functional foundation:** useful domain, schema or actions exist, but the
  source tool has not been reproduced.
- **Shell:** source chrome exists, but required actions are fake or incomplete.
- **Wrong:** a generic rewrite occupies the slot and must be replaced.
- **Missing:** no material implementation of the specified tool exists.

## Audited status — 2026-08-02

| Surface                                    | Current implementation                                                                              | Honest status and required correction                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Voice + drag fit slider                    | `apps/retailer/components/fit-tools/vox-fit-slider.tsx`, `vox-source.ts`, real fitting observations | **Faithful foundation.** Exact widget is real; move it out of the invented generic alteration experience and connect the complete first-fitting decision/work-order journey. Supplier write-back may remain an explicit external boundary.                                                               |
| Silhouette analysis                        | `apps/retailer/components/fit-tools/silhouette-carousel.tsx`                                        | **Wrong.** Generic Tailwind carousel with invented silhouettes. Replace with the source Level 1 interaction, then add the specified individual-analysis and prediction progression without claiming unsupported measurement truth.                                                                       |
| QR try-on / fabric batch concept order     | none found                                                                                          | **Missing.** Build the exact scan interaction and safe concept-order batch workflow.                                                                                                                                                                                                                     |
| First-fitting automation                   | observations and alteration primitives                                                              | **Functional foundation.** No connected imperfection → FitProfile candidate → reviewed alteration work-order automation.                                                                                                                                                                                 |
| Mission Control / customer cockpit         | retailer dashboard, clienteling and Self-Portrait primitives                                        | **Functional foundation.** Real operational data exists, but the source's integrated cockpit and choreography are not reproduced.                                                                                                                                                                        |
| MorningRoutine composed look               | domain, repository, migration, actions and generic customer panel                                   | **Functional foundation.** Current code ranks/list items; it does not reproduce the source's complete-look canvas and behavior.                                                                                                                                                                          |
| Lapel/pocket/shoulder configurator         | none found                                                                                          | **Missing.**                                                                                                                                                                                                                                                                                             |
| Swipe deck                                 | `apps/customer/app/r/[slug]/swipe/swipe-deck.tsx`                                                   | **Connected implementation.** Source spacing/motion, real data, retry-safe save/recovery, versioned consent-aware resume, keyboard/mobile touch, reduced motion, withdrawal and wishlist proof pass. Product-concept → StyleProfile/downstream reason proof and canonical breakpoint screenshots remain. |
| TableService / MunroMessenger              | `apps/customer/app/r/[slug]/table-service-widget.tsx`                                               | **Shell plus useful guidance.** Visual port and real inquiry/handoff exist, but photo/PDF/Pinterest/wedding-fabric attachment controls do not perform their stated jobs.                                                                                                                                 |
| Inspiration Box / gift booklet             | none found                                                                                          | **Missing.**                                                                                                                                                                                                                                                                                             |
| Location globe and monthly visual grid     | none found                                                                                          | **Missing.**                                                                                                                                                                                                                                                                                             |
| Six-rail wardrobe                          | real wardrobe records and six generic card sections                                                 | **Functional foundation.** Data/provenance are valuable; replace the generic UI with the founder's tactile stacked-rail composition and motion.                                                                                                                                                          |
| Pag2 groom/best-men planner                | party/member/invite/fitting-state model, generic pages, faithful orbit, additional domain/schema    | **Functional foundation.** Invitation basics work, but group date coordination, personal options, fitting/delivery/pickup tracking and the source planner experience are incomplete. Domain/schema-only Stage 16.5 work is not the product.                                                              |
| Pag3 Preferred Tailoring / HighMaintenance | service plans, entitlements, bookings, care/cost/history and partner schema; generic pages          | **Functional foundation.** Strong operational primitives, but no faithful weekly calendar, agenda/travel-driven looks, care animation, connected custody/partner UI or end-to-end proof.                                                                                                                 |

This table is the correction map for R0.3. It does not erase useful
foundations; it prevents them from being mistaken for the founder-specified
end product.

## AM House Party orbit — done 2026-07-28

`am-house-hero.tsx` remains the video-hero shell (`wed2027.mp4`). The
actual `#ow` orbit now lives in `am-house-orbit.tsx`: source CSS and
`orbitR: 130` / sine-drift animation preserved; center + ring avatars
come from `WeddingPartyMember` (`photoUrl`, initials fallback).

## Fit tools are not parked

The earlier 2026-07-27 parking decision inferred that a missing supplier write
API made the whole tool useless. The founder has rejected that inference.
PAON can capture evidence, create a reviewed FitProfile candidate, create and
track in-house or partner alteration work, inform reorder safety and prepare a
source-authorized supplier handoff. Only the unavailable external write-back
is blocked.

## `/alterations/*` is not a founder-designed surface

Everything under `apps/retailer/app/(dashboard)/alterations/` — including
`/alterations/new` and the "Fit tools" panel on the detail page — was
invented by an engineering session. It matches nothing in `pag1.html` and
carries none of the founder's cues. **Do not treat any of it as canonical
design, and do not extend it.**

This is the trap that cost a full increment: a verbatim widget port was
placed inside an invented screen, so a correct port still produced something
the founder did not recognise. Before porting any widget, confirm the
surface it lands on is founder-designed. If it is not, stop and ask.

**What the real host must do.** Do not discard fit correction or leave it in a
generic detail page. The connected experience must preserve the founder fit
tool while carrying its evidence into reviewed FitProfile decisions,
alteration work orders, workshop custody, cost and outcome. Where the source
does not design the surrounding operational screen, build a PAON-native host
around the exact widget and verify the resulting journey with the founder.

## How to extract a widget from the source

Do not retype it. Transcribing 1,000 lines by hand introduces errors that
are invisible until the founder looks at the screen. Extract it
mechanically, the way surface 1 was done:

```
python3 - <<'PY'
import json
src = open('downloaded_pages/pag1.html', encoding='utf-8', errors='replace').read()
i = src.find('.SELECTOR-widget-root')                      # a class unique to the widget
s = src.find('>', src.rfind('<style', 0, i)) + 1
css = src[s:src.find('</style>', i)]
j = src.find('SOME_UNIQUE_FUNCTION_NAME')                  # a symbol unique to its script
js = src.find('>', src.rfind('<script', 0, j)) + 1
script = src[js:src.find('</script>', j)]
open('path/to/widget-source.ts','w').write(
  'export const CSS = ' + json.dumps(css) + ';\n'
  'export const SCRIPT = ' + json.dumps(script) + ';\n')
PY
```

`json.dumps` is doing real work here: the founder's scripts are full of
regexes, and pasting them into a TypeScript template literal would turn
`\b` into a backspace character and silently corrupt every word boundary.
Add the generated file to `.prettierignore`.

## What a correct port looks like

The pattern is already proven in this repository — ADR-046/047/048 did it
for `paon-template.html` and the table-service widget.

1. **Copy the source verbatim** into a component file: the founder's `<style>`
   block, markup and script, unchanged. The widgets already self-scope via
   id/class prefixes (`vox-`, `nbs-`, `gcw-`, `amibx-`), so they do not leak.
2. **Add data hooks only.** A JSON injection point, a submit handler, a prop
   for the initial value. Nothing else.
3. **The only permitted deviations**, both of which must be noted in the
   component:
   - Accessibility fixes this repo's lint requires — a `<div onClick>`
     becomes a `<button>`, styled with inline resets so it is visually
     identical.
   - Removing hardcoded credentials. The Cesium globe embeds a live Ion
     access token; that must come from an environment variable.
4. **Do not** reformat it. `paon-template.html` is already exempt from
   prettier for this reason (`.prettierignore`); ported widget files should
   be treated the same way if prettier would rewrite them.

## Why this overrides the design-system rule

`CLAUDE.md` says never duplicate a component and always build from
`@paon/ui`. For everything PAON builds itself, that still holds. For these
surfaces it does not, and the trade is deliberate: the founder's designs are
the product's differentiator, they took months to make, and a session
following the design-system rule will faithfully destroy them. Consistency
with the design system is worth less than the design.

The cost is real and is accepted: these components sit outside the token
system, will not inherit theme changes automatically, and cannot be
restyled centrally. That is the price of keeping them exact.

## Scope and sequencing

These are product tools, not disposable pitch decoration. Heavy dependencies
such as Cesium or three.js still require bundle, performance, accessibility,
privacy and operating-cost decisions, but those decisions may not silently
convert an explicit requirement into a generic substitute. `PHASE.md` orders
coherent slices; R0.3 records each tool's module, dependency and proof plan.
