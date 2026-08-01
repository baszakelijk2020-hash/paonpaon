# PAON Agent Charter

This is the cross-agent entry point for Codex, Cursor, Claude Code and other
builders. `CLAUDE.md` points here; it is not a second charter.

## Minimum context

For an ordinary implementation turn, read only:

1. `AGENTS.md`;
2. the active gate/item at the top of `docs/PHASE.md`;
3. the Resume Protocol at the top of
   `docs/PAON_INTELLIGENCE_PLATFORM.md`;
4. the ADR named by the item;
5. directly relevant code, tests, repository and migration.

For work derived from `downloaded_pages/pag1.html`, `pag2.html`, `pag3.html`
or a founder-linked Nebelspiegel tool, also read the relevant `FT-*` contract
in `docs/FOUNDER_TOOL_BLUEPRINTS.md`, its row in `docs/DESIGN_PORTS.md`, and
the exact committed source fragment. These tools carry both an experience
contract and a system-behaviour contract; a generic replacement is not an
implementation. The founder-control section in the blueprint decides who may
change which part of the contract.

Use `docs/README.md` to cross a topic boundary. Read `NORTH_STAR.md` and the
founder-control section of `FOUNDER_TOOL_BLUEPRINTS.md` for a product decision.
Read the founder brief, source audit or full programme only for product
ambiguity, traceability conflict or a strategic audit. The raw brief preserves
input; it is not permission to undo its later PAON curation. Code and
migrations are factual truth; `PHASE.md` is the only queue.

If an item can touch cloud data, migrations, integration tests or e2e, also
read the environment ledger named by the item and identify the exact Supabase
project before running anything. Unknown is a stop condition for the live
action, not permission to infer.

## Continuous-build contract

Work through the authorized queue:

> inspect -> implement one coherent slice -> test -> repair -> update
> authoritative state -> commit -> push the task branch -> take the next item

Do not stop for routine review or strategy reopening. Stop for a hard blocker
defined by `PHASE.md`, and skip it when a later independent item is buildable.
Do not continue a legacy Stage 9–16 item until R0.3 maps it to an ADR-070
module chapter and current acceptance contract.

Every completed slice leaves authoritative state current, checks green and the
commit pushed to the currently authorized task branch. Never infer permission
to update `main` from a stale document. `PROJECT_STATE.md` is a factual
snapshot only; it is never a queue or authority.

## Product invariant

PAON's destination is the complete entitlement-controlled modular platform in
`NORTH_STAR.md`. Its first demonstrator and shared intelligence spine is:

```text
House Memory -> Advisor Today -> composed proposal -> order/fitting/alteration
  -> aftercare -> captured outcome
```

New capabilities compose into role homes and shared Client, Garment,
Conversation and Order/Service pages before earning top-level navigation.
The spine is a connected-proof invariant, not a restriction on the committed
Retail Operations, Enterprise/Vertical or Network/Ecosystem modules.

## Engineering invariants

- Strict TypeScript; no `any`.
- Business concepts and pure rules live in `@paon/domain`.
- Supabase access lives behind `@paon/database` repositories.
- Every tenant-owned row carries `retailer_id`, is protected by RLS, and
  validates same-tenant foreign references.
- Browser mutations are Server Actions. Route Handlers are for non-browser
  callers, webhooks, scheduled jobs and the founder-HTML exception.
- Reuse shared components and rules; do not duplicate them across apps.
- Founder-specified tools governed by ADR-052/071 remain visually and
  behaviourally faithful ports. Their source markup, CSS, motion, composition
  and interaction are the experience authority; real PAON data, permissions,
  persistence and multi-role continuation are the system authority. Brand and
  commercial framing may be adapted, but a Tailwind approximation, static
  shell or domain-only scaffold is not "built." For non-designated source
  material, curate the underlying job and interaction grammar into PAON.
- New schema changes are forward migrations with generated types, repository
  coverage, tenant-isolation verification and upgrade rehearsal when data
  changes.
- Provider behavior requires a current contract or real sample. Fixture
  signatures, headers and write paths are never presented as provider facts.
- Preserve unrelated user/agent work. Inspect a dirty tree before editing;
  never reset or overwrite it for convenience.

## Environment safety

- Never run integration/e2e or apply migrations until the exact target project
  is identified and classified as disposable or explicitly approved.
- Test suites create real rows. `PAON_INTEGRATION=1` is not a safety boundary.
- A clean-database run is not upgrade proof. Rehearse data migrations on a
  restored copy with counts, money and invariants.
- Never commit credentials. Do not assume Hyperagent's external helper scripts
  or management token exist locally.
- Stop live `pnpm dev` before a production build; Playwright `webServer` may
  otherwise test a stale build.

## Proving a slice

A slice is complete only when the rule is reachable from the originating
role, changes authoritative state, appears for the receiving role and survives
its applicable denied/stale/conflict/correction path. Read
`docs/runbooks/BROWSER_PROOF.md` only for browser/live proof; do not pay that
context cost for pure documentation or a domain-only change.

Live integration suites are gated by `PAON_INTEGRATION=1` and skipped by
ordinary `pnpm test`. Check every Supabase write result; `.update()` errors do
not throw automatically. Specs own and clean the rows they create.

## Definition of done

Run the checks CI runs, proportionate focused checks while iterating and the
full sequence once for a completed code tranche:

```text
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

Commit intentionally and push the authorized task branch. A slice is not
complete while finished work is uncommitted/unpushed or the authoritative
queue is stale.

## Evidence discipline (ADR-068)

`docs/evidence/runs/<item>.json` records a passed run whose `gitSha` is
reachable from `HEAD` by evidence-only changes:

1. commit code;
2. run proof so it records that SHA;
3. commit evidence alone.

A checked `PHASE.md` box is a formal completion claim and requires applicable
current evidence. Never weaken the validator or re-date evidence to create
completion. Product-code changes stale earlier connected proof; documentation
may explain status but cannot substitute for rerunning it.
