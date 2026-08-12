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

| Source                                          | Contains                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/customer/app/r/[slug]/paon-template.html` | The storefront — the retailer's digital front door                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `downloaded_pages/pag1.html`                    | Voice/drag fitting (parked), QR try-on/fabric batch (deleted, FT-03 — historical source content only), first-fitting automation, silhouette analysis (consolidated into alterations), Mission Control/Self-Portrait, MorningRoutine, lapel configurator (consolidated into Virtual Wardrobe Studio), swipe, TableService, Inspiration Box, globe. The page also contains unrelated Atelier Munro B2B "Merchant"/training marketing content that is not a PAON tool — see `NORTH_STAR.md`/`CAPABILITY_DISPOSITION.md` on parked marketplace/B2B scope. |
| `downloaded_pages/pag2.html`                    | Moonstruck; PAON's designated scope is the groom/best-men inspiration, invitation, personal-profile, group-date, fitting, delivery and pickup planner                                                                                                                                                                                                                                                                                                                                                                                                 |
| `downloaded_pages/pag3.html`                    | Residents Club context; PAON's designated scope is Preferred Tailoring's weekly calendar-led wardrobe orchestration and the HighMaintenance care workflow                                                                                                                                                                                                                                                                                                                                                                                             |

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

| Surface                                    | Current implementation                                                                                                                                                                                                                                                                                                                                                                                                   | Honest status and required correction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Voice + drag fit slider                    | `apps/retailer/components/fit-tools/vox-fit-slider.tsx`, `vox-source.ts`, real fitting observations                                                                                                                                                                                                                                                                                                                      | **Faithful foundation.** Exact widget is real; move it out of the invented generic alteration experience and connect the complete first-fitting decision/work-order journey. Supplier write-back may remain an explicit external boundary.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Silhouette analysis                        | `apps/retailer/components/fit-tools/silhouette-widget.tsx` — exact port of `pag1.html`'s `#nbs-silhouette-widget-a91k` (confirmed present, checked directly 2026-08-02)                                                                                                                                                                                                                                                  | **Connected first slice.** The invented Dutch-language SVG carousel (Slank/Regulier/Atletisch/Gezet) is gone; the real S1–S5 video panels, auto-advance/dwell/touch-pause carousel and the two "anticipated FitTools" glow-toggle rule columns are byte-for-byte from source. A PAON-added "Select" button records the active panel as a fit-tool observation — the source itself has no selection control. Not built: the specified individual-analysis and prediction progression (Level 2/3), which the blueprint requires be labelled unavailable rather than fabricated, not silently added here.                                                                                                                                                           |
| QR try-on / fabric batch concept order     | historical `concept_scan_codes` implementation exists (FT-03)                                                                                                                                                                                                                                                                                                                                                            | **Deleted from active scope (founder decision, 2026-08-05/2026-08-12).** Do not build, extend, expose or market QR try-on or fabric-batch scanning. Retained here only to explain existing history; not a gap to close.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| First-fitting automation                   | observations and alteration primitives                                                                                                                                                                                                                                                                                                                                                                                   | **Functional foundation.** No connected imperfection → FitProfile candidate → reviewed alteration work-order automation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Mission Control / customer cockpit         | retailer `/dashboard` Brief (761 lines, real role-scoped attention/appointments/pace data), `/customers/[id]` + `advisor-preparation-brief.tsx` (1132 lines, real composited client view), `apps/customer/app/(dashboard)/account/style-profile-panel.tsx` (272 lines, real declared/inferred Self-Portrait facts with correction) — all checked directly 2026-08-02, more substantial than this row previously credited | **Functional foundation, more mature than previously documented, still not the designated cockpit.** No interactive "MissionControl"/"Self-Portrait" fragment exists in `pag1.html` (checked directly — narrative text plus one small unrelated decorative logo-carousel), so there is no staged-reveal choreography to port. Real advisor-Today, per-customer composited, and customer-correctable-facts surfaces already exist and work with real data; the customer-facing Self-Portrait correction UI had zero e2e proof and now has a first browser journey. Not verified/proven this round: the advisor-facing Today dashboard and per-customer composited view, ranking-rule/evidence-window versioning, and cross-module degrade-independently behavior. |
| MorningRoutine composed look               | domain, repository, migration, actions plus `apps/customer/app/(dashboard)/morning-routine/routine-panel.tsx`; no interactive complete-look canvas fragment exists in `pag1.html` (checked directly 2026-08-02 — only marketing narrative and a decorative live-weather-camera overlay)                                                                                                                                  | **Connected first slice.** Built with PAON primitives against the blueprint's physical description, not a source port: the top recommendation is a large featured "Today's look" card, the rest form a horizontal "Complete the look" strip with non-owned pieces marked. Every existing Server Action/field is unchanged. Fixed a real gap: `primaryImageUrl` existed on the domain type but was dropped in the view mapping. First e2e coverage added (previously zero). Not built: live weather/calendar wiring, delivery-job notification.                                                                                                                                                                                                                   |
| Lapel/pocket/shoulder configurator         | `pag1.html`'s `#suit-configurator-widget` confirmed present (checked directly 2026-08-02 — this row's prior "none found" was wrong); `apps/customer/app/r/[slug]/configurator/suit-configurator-widget.tsx` is a byte-for-byte CSS/markup/image-URL port                                                                                                                                                                 | **Connected first slice.** Three synchronized carousels, predefined model combinations (Henk/Willem/Karel), scroll-snap-to-panel and opacity crossfade all reproduced (GSAP replaced with an equivalent hand-rolled rAF tween/CSS transition — no GSAP dependency exists in this codebase). Explicit save persists to `suit_configuration_intents`. Still missing: prohibited combinations, version pinning, retired-option recovery, cross-House isolation, advisor-side visibility UI, configuration-to-proposal/MTM continuation.                                                                                                                                                                                                                             |
| Swipe deck                                 | `apps/customer/app/r/[slug]/swipe/swipe-deck.tsx`                                                                                                                                                                                                                                                                                                                                                                        | **Connected and proven.** Source spacing/motion and locally pinned source icons; real data; retry-safe save/recovery; versioned consent-aware resume; keyboard/mobile touch; reduced motion; wishlist; accepted-concept StyleProfile evidence; visible related For You reason; withdrawal; and cross-platform desktop/390px snapshots pass.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| TableService / MunroMessenger              | exact `paon-template.html` widget + typed message API/action/repository                                                                                                                                                                                                                                                                                                                                                  | **Connected first slice.** The exact storefront and React child-route port now send text plus photo/PDF/Pinterest/wedding-fabric material into one private conversation with preview/remove, rights, basic byte/MIME/size/link validation, signed reads and retained failures. Still incomplete: async malware/quarantine, progress, party/garment links, consent/citation proof and conversation-to-look-to-outcome proof.                                                                                                                                                                                                                                                                                                                                      |
| Inspiration Box / gift booklet             | none found (reconfirmed 2026-08-02 — the only source occurrence is one static marketing sentence, not a component)                                                                                                                                                                                                                                                                                                       | **Connected first slice**, built with PAON primitives since there is no source fragment to port: `apps/retailer/app/(dashboard)/gifts` (curate/invite) and `apps/customer/app/r/[slug]/gift/[token]` (anonymous reveal/redeem). Still incomplete: expiry/revoke polish, resend, giver payment/request flow, recall/refund.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Location globe and monthly visual grid     | none found                                                                                                                                                                                                                                                                                                                                                                                                               | **Missing.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Six-rail wardrobe                          | real wardrobe records; no interactive rail fragment in source (checked directly 2026-08-02 — `pag1.html` only has a decorative, differently-categorised homepage carousel)                                                                                                                                                                                                                                               | **Connected first slice**, built with PAON primitives against the blueprint's own physical description (opening/closing, layered depth, horizontal movement), not a pixel port: `apps/customer/app/(dashboard)/wardrobe/wardrobe-panel.tsx`'s `WardrobeRail`. Keyboard roving, reduced motion, layered peek-stack preview when closed. Provenance/correction controls unchanged. Still generic: no composed-look transition, no MorningRoutine/service continuation from the rail.                                                                                                                                                                                                                                                                               |
| Pag2 groom/best-men planner                | party/member/invite/fitting-state model, generic pages, faithful orbit, additional domain/schema                                                                                                                                                                                                                                                                                                                         | **Functional foundation.** Invitation basics work, the accepted group-fitting capacity exception is real scheduled capacity only rather than an invented rate, and the public invite→join browser flow is proven. Group date coordination, personal options, fitting/delivery/pickup tracking, anniversary continuation and the source planner experience are still incomplete. Domain/schema-only Stage 16.5 work is not the product.                                                                                                                                                                                                                                                                                                                           |
| Pag3 Preferred Tailoring / HighMaintenance | service plans, entitlements, bookings, care/cost/history and partner schema; generic pages                                                                                                                                                                                                                                                                                                                               | **Connected first slice.** Safe auth-derived customer booking-linked custody projection, source-paced `/services` care journey, existing retailer custody state machine module-gated, focused customer/retailer browser proof, and accepted customer-visible canonical care outcomes at `0776418` (authenticated retailer `recordCare` flow -> customer `/services` reload, customer-safe care history, cross-customer absence proof). Still missing: full weekly calendar-led wardrobe composition, partner portal/custody transition proof beyond retailer action, entitlement/cost variance, delayed/disputed/failed-handoff recovery, and full source-motion parity.                                                                                         |

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
