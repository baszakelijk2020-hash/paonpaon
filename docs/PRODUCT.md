# Product

PAON is delivered through three applications over one domain model and one
design system. The applications are viewpoints into one relationship, not
three independent feature catalogues.

## The golden relationship journey

The product is coherent only when one real client can move through this loop:

```text
Admin prepares a retailer and trusted data
  -> advisor sees Today and prepares a conversation
  -> client/advisor composes a wardrobe or service next step
  -> appointment/order/production/fitting progresses
  -> delivery and aftercare complete the promise
  -> outcome updates the relationship and garment history
```

Every active feature must identify where it enters this loop, who continues
it, what authoritative state it changes, and how the outcome becomes future
context.

## 1. PAON Admin — `apps/admin`

Admin exists to launch, protect and support retailer relationships. Its core
jobs are:

- qualify and onboard a retailer;
- map environments, data authorities and integrations;
- migrate and reconcile a controlled cohort;
- configure plans, entitlements, brand presentation and house standards;
- monitor tenant health, consent, AI cost/quality and connector failures;
- support a tenant through explicit, audited access;
- operate Demo Studio without confusing demonstration data with production.

Admin is not a second retailer portal. Cross-tenant analytics and network
operations activate only when the relevant commercial layer is authorized.

## 2. Retailer Portal — `apps/retailer`

The primary staff experience is **Today**, not a module directory. It answers:

1. Who needs attention?
2. What do I need to know?
3. What promise or risk is due?
4. What is the next best human action?
5. Can I complete or capture it in seconds?

Shared object pages hold the depth behind Today:

- **Client / House Memory:** relationship timeline, consent, preferences,
  wardrobe, fit evidence, appointments, orders, services and outcomes;
- **Garment:** identity, ownership, fit, order/production projection,
  alterations, custody, care and lifecycle;
- **Conversation / Appointment:** preparation, composed proposals, notes,
  follow-up and outcome;
- **Order / Service case:** money, status, exceptions, source authority,
  promises and handoffs;
- **Programme:** campaign or service version, audience, missions, placements,
  operational prerequisites and measured outcomes.

Manager Mission Control adds staffing, inventory/custody, operational health,
campaign management, reconciliation and analytics. Capabilities should appear
in context before earning top-level navigation.

## 3. Customer Portal — `apps/customer`

The customer experience is the calm, visible proof that the house remembers.
Its primary surfaces are:

- **Home / For You:** a small number of timely, explainable next moments;
- **Wardrobe:** tactile category rails for owned, self-added and advisor-
  proposed pieces, with provenance and correction;
- **A composed look:** MorningRoutine, TableService and advisor proposals that
  present a confident ensemble before configuration detail;
- **My journey:** appointment, order, production, fitting, alteration,
  delivery and aftercare as related but distinct timelines;
- **Honeymoon:** the post-order window for anticipation, preparation,
  complementary pieces, pickup and fit—not generic notification spam;
- **Services and relationship:** care, membership, messages, milestones and
  preferences under the retailer's brand.

A client may have relationships with multiple retailers, but each house's
data, consent and presentation remain separate. PAON must never imply that one
retailer can see another's relationship.

## Authority boundaries

PAON owns relationship memory, garment/service evidence, customer-visible
continuity, in-store alterations/custody, and the actions/outcomes it creates.

External systems may remain authoritative:

- Shopify or another commerce platform for catalogue, checkout or order facts;
- Faden, GoCreate or factory software for MTM configuration and production;
- POS for tender and fiscal transaction truth;
- payroll/accounting providers for payroll, tax and books;
- messaging/calendar providers for delivery and scheduling channels.

For every integrated field group, PAON records source, direction, external
identity, freshness, conflicts and the permitted action. An invented API,
signature format or write-back capability is not an integration.

## Order, production, fitting and alteration

- **Order** is the commercial record.
- **Production** is a source-authorized manufacturing projection.
- **Fitting** records observations and decisions with provenance.
- **Alteration** is an independently progressing piece of work on a physical
  garment.
- **Aftercare** records custody, care, repair and return after delivery.

They can be related and visible on one journey, but must not be collapsed into
one status. A photo or self-scan may create evidence or a review candidate; it
does not silently become an approved measurement.

## Founder-source experience contract

The founder-authored corpus is both design research and, for the tools the
founder explicitly selected, a product specification. Pag1's specified tools,
pag2's groom/best-men fitting-planning workflow, pag3's Preferred Tailoring and
HighMaintenance workflow, and tools explicitly called out in the founder brief
must retain the source composition, motion and behaviour while narrow hooks
connect them to real PAON data and actions. "PAON-native" does not authorize a
generic redesign of those tools.

The wider corpus also supplies reusable patterns:

- cinematic chapter opening and live context;
- narrow editorial reveal with high contrast and purposeful pacing;
- stacked horizontal wardrobe rails with a clear active item;
- composed outfit canvas with item-level inclusion controls;
- a short guided menu instead of exhaustive first-step configuration;
- visual timelines and live progress for waiting periods;
- context cards combining weather, calendar, place and wardrobe evidence;
- campaign experiences that connect story, product, staff action and outcome.

For non-designated surfaces these patterns should be translated into
accessible, responsive PAON components. ADR-052/071 governs the designated
tools. Their completion requires visual/motion parity, real domain and
persistence, the complete role workflow, and connected browser-plus-database
proof; satisfying only one layer is a foundation, not a shipped tool.

## Module system and commercial packaging

The eight module families in [NORTH_STAR.md](./NORTH_STAR.md) form one product
over one platform kernel. They are not eight applications and later families
are not merely a speculative option list.

Each deployable module declares:

- required platform and module dependencies;
- retailer entitlement and state (`off`, `preview`, `active`, `suspended`);
- roles, contextual navigation and background jobs it enables;
- authority mode (`overlay`, `co-managed`, or `full PAON`) for shared data;
- plan limits, metering and commercial catalogue identity;
- onboarding, rollback, export and audit behavior.

Plans are changeable bundles of modules. A practical starting family is
Foundation, Intelligence, Growth, Operations, and Enterprise & Network, with
eligible modules available as add-ons. Final names and pricing are commercial
decisions; tenant-safe entitlements and dependencies are technical contracts.
No tier should create a forked codebase, orphan historical data, or expose a
surface whose dependencies are unavailable.

A baseline bundle hypothesis is:

| Module family                      | Foundation | Intelligence | Growth   | Operations | Enterprise & Network |
| ---------------------------------- | ---------- | ------------ | -------- | ---------- | -------------------- |
| Platform Core                      | Included   | Included     | Included | Included   | Included             |
| Client & Relationship Intelligence | Essentials | Included     | Included | Included   | Included             |
| Wardrobe & Styling Intelligence    | Add-on     | Included     | Included | Included   | Included             |
| Commerce & Growth                  | Add-on     | Add-on       | Included | Included   | Included             |
| Garment & Service Operations       | Add-on     | Add-on       | Add-on   | Included   | Included             |
| Retail Operations                  | Add-on     | Add-on       | Add-on   | Included   | Included             |
| Enterprise & Vertical Solutions    | —          | —            | Add-on   | Add-on     | Included             |
| Network & Ecosystem                | —          | —            | —        | Add-on     | Included             |

This matrix is a commercial hypothesis to test, not permission to omit a
module from the build. `Add-on` means independently entitlement-controlled;
ecosystem activation still observes the applicable partner, legal and money
gates.

The golden relationship journey is PAON's first connected demonstrator and
ongoing regression spine. It proves that the modules compose; it is not the
maximum product PAON intends to build.

`PHASE.md` is the only build order. This document describes the intended
product and boundaries; code and migrations remain the truth for what exists.
