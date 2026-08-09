# PAON Agent Charter

This is the cross-agent entry point for Codex, Cursor, Claude Code and other
builders. `CLAUDE.md` points here; it is not a second charter.

**A model session is disposable. The repository is the memory.** When a
frontier session's own quota/context is exhausted, it does not hand off
through conversation — it leaves the working tree, `PHASE.md`'s item status,
and (if genuinely needed) the Resume Protocol block below in a coherent
state, then stops. The next session, on any model, cold-starts from this
file, never from a transcript.

**Quota-aware handoff (Claude, Codex, or any future frontier model).**
Neither tool exposes a proactive percentage-remaining signal for the
rolling 5-hour or weekly usage limit as of this writing; react to whatever
native "approaching limit"/rate-limit warning the tool actually surfaces,
and otherwise keep coherent slices short enough that a hard limit rarely
lands mid-slice. On such a warning, or once a hard limit is hit: stop
starting a new architectural slice or a new large delegated batch, finish
and independently verify the current coherent unit, commit it, record a
genuine blocker only through `PHASE.md`/the Resume Protocol as usual, and
stop. The 5-hour cap is as valid a handoff point as the weekly one — do not
idle waiting for reset if a clean stop is available now. This never means
switching accounts/logins automatically; it means leaving the repository
ready for whichever frontier seat resumes next, through the same minimal
cold-start path above.

Elapsed runtime, a completed slice, a self-estimated token count, context
pressure, or a guess that capacity may be low is **not** a native quota
warning. Without an actual CLI/API warning or hard quota/auth error, take the
next independent buildable item. Never end with "stopping per capacity
guidance" merely because one slice was committed.

## Minimum context

For an ordinary implementation turn, read only:

1. `AGENTS.md`;
2. the active gate/item at the top of `docs/PHASE.md`;
3. the Resume Protocol at the top of
   `docs/PAON_INTELLIGENCE_PLATFORM.md`;
4. the ADR named by the item;
5. directly relevant code, tests, repository and migration.

Escalate past this list only when it fails to resolve a specific question in
front of you, and escalate to the narrowest source that can answer it — one
more ADR, one blueprint section, `docs/README.md` to find the right document,
`docs/PROJECT_STATE.md`'s current snapshot — not a wider read by default. An
ordinary slice does not require reading `PHASE.md` end to end, every ADR in
`DECISIONS.md`, every `FT-*` blueprint, `PROJECT_STATE.md`'s history, or the
repository at large; each of those is on-demand, not baseline.

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

## Unattended frontier runner

Start the session-owned outer loop once from the authorized task branch:

```text
pnpm paon:run
```

For a terminal-independent named session that survives a closed terminal,
start the same foreground loop inside macOS `screen`:

```text
pnpm paon:start
```

Check it with `pnpm paon:status` and stop it explicitly with
`pnpm paon:stop`. Add `-- --provider claude` to `paon:start` to use Claude.
Launching plain `codex` or plain `claude` directly bypasses the outer loop and
will stop normally after a model turn; it is never the unattended entry point.

That uses the installed Codex CLI and the machine's existing
`approval_policy = "never"` / `sandbox_mode = "danger-full-access"`
configuration. To put Claude in the frontier seat instead, run:

```text
pnpm paon:run -- --provider claude
```

The Claude path uses the installed CLI's noninteractive print/resume mode and
bypasses interactive permission prompts for this already-trusted repository.
Both paths are the same foreground loop: keep that terminal/session open and
press Ctrl-C once to stop explicitly. Do not paste `continue`, relaunch the
agent at a returned prompt, or start a second frontier runner.

The runner holds one atomic lock in the repository's shared Git directory, so
two frontier writers cannot operate across PAON worktrees at once. A normal
successful turn cold-starts the next model session from Git, `PHASE.md`, the
Resume Protocol and the named ADR; a failed/interrupted noninteractive turn is
resumed by exact session id while the same process still owns the lock. It
never resets, cleans, switches or removes a worktree. Existing dirty state is
valid repository memory and is passed to every next turn unchanged unless the
authorized slice intentionally owns it. Before every invocation it saves the
tracked binary patch, untracked-file archive (excluding registered delegated
worktrees), status, branch and HEAD under the shared Git runtime directory, so
an accidental destructive turn still leaves a local recovery copy outside the
worktree.

Quota/auth exhaustion, a frontier-reported genuine hard blocker, an unfinished
Git operation, branch switching, or the bounded rapid-failure/no-progress
circuit breakers stop the loop with all state and per-turn logs preserved.
Ordinary agent exit, a completed commit, or a turn/context boundary does not.
Run `pnpm paon:run -- --provider <codex|claude> --dry-run` for a zero-model-call
preflight, and `pnpm paon:run:test` for the bounded local runner harness.

## Multi-lane parallel work

More than one agent/session may work the queue at once, each on its own
lane. A lane is a dedicated branch forked from the currently authorized
task branch, named `agent/lane-<letter>-<module>` (e.g.
`agent/lane-b-stage15-lifestyle-network`). Never two lanes on one branch.

Assigning a module to a lane:

- Pick a `PHASE.md` stage/item range whose tables, migrations and files are
  disjoint from every other active lane's range. Verify disjointness by
  grep, not assumption — a shared table (even read-only) still forces
  serialized migration ordering.
- Record the assignment (lane branch name, module, start SHA) in
  `PROJECT_STATE.md` when the lane is created, and again whenever it
  changes. `PROJECT_STATE.md` stays a factual snapshot, never an authority.
- A lane never edits a table, migration or shared package export another
  active lane owns, even in passing. If a slice needs that, stop and
  reconcile lanes first rather than guessing at the other lane's intent.

`PHASE.md` conflicts (the one file nearly every item touches):

- Each lane appends only its own dated status/addendum text to the items
  in its assigned module. Never edit another lane's addendum, and never
  reflow or renumber sections outside your module to "clean up" a merge.
- Do not continuously co-edit `PHASE.md` on a shared branch. Lanes merge
  back into the authorized task branch at deliberate checkpoints, not
  continuously.
- At merge time, a `PHASE.md` conflict is resolved by hand: keep both
  lanes' item blocks verbatim: an automatic "ours"/"theirs" resolution is
  never applied, since it silently deletes the other lane's evidence
  trail.

Migration filename collisions: before naming a new migration, check the
other active lane's branch (not just your own) for already-used timestamp
prefixes. If a collision surfaces at merge time, the migration merged
second is renamed forward in time; an existing applied migration's
filename is never rewritten.

Every other rule in this charter (continuous-build contract, engineering
invariants, environment safety, proving a slice, definition of done,
evidence discipline) applies identically inside each lane. A lane is a
branching discipline, not an exemption from any of it.

## Cheap-worker delegation

A bounded, mechanical remainder of a `PHASE.md` item may be handed to a
cheaper model (OpenRouter/Zoo or equivalent) instead of a frontier session.
This is the same lane discipline above, not a second system: no task
database, no YAML, no scheduler.

**Feature-slice-delegation gate.** For every bounded implementation task,
the frontier agent MUST invoke the `feature-slice-delegation` skill before
implementing directly. Direct implementation is allowed only when the
skill itself determines delegation is inappropriate for that task.

A delegated task is accepted only after the frontier agent independently
verifies: (1) the delegated worktree exists; (2) the expected files were
actually changed; (3) a valid git commit exists on the delegated branch;
(4) the commit SHA resolves with `git cat-file -e <sha>^{commit}`; (5) the
required tests/checks pass when rerun by the frontier agent. A delegate's
textual completion report is never evidence of completion. If any
verification fails, the delegation is considered failed and the frontier
agent may implement the bounded task directly without delegating it a
second time.

**Autonomous delegation rule — binding on every frontier agent (Claude,
Codex, or any other model occupying the frontier seat), not a
model-specific optimization.** The active frontier agent is the only
dispatcher; nothing separately scans or assigns `PHASE.md` work. During
ordinary implementation the frontier agent MUST continuously separate
frontier-owned judgment from bounded mechanical remainder, and the instant
a remainder is fully `Delegable` below, it MUST invoke `pnpm paon:delegate`
for that remainder itself — not implement it inline, not propose it and
wait. It MUST then wait for the structured JSON result, inspect the
worker's commit/diff and verification output itself, accept/fix/re-delegate
as appropriate, and continue the original slice — all without founder
intervention. Do not ask the founder to open Zoo/OpenRouter, copy a prompt,
start the worker by hand, relay the worker's output back, or approve
continuing before you do. A judgment call earlier in the same item (e.g. an
RLS design decision) does not make the rest of that item frontier-only —
what remains delegable is decided by the state actually reached during
implementation, not decided in advance. Any `.claude/skills/` helper that
touches this workflow is a convenience layer for whichever tool reads
skills; this paragraph, not the skill, is what every frontier agent is
bound by. The cheap worker gets its own lane branch,
reads the same `AGENTS.md`/`PHASE.md`/ADR path any agent reads, runs the
same definition-of-done command, and hands back a normal commit. Nothing
about resuming afterward changes — the next frontier session still reads
`PHASE.md`, the Resume Protocol and `git log`, never a special handoff file.

**Delegable** — already has a settled shape and needs no judgment call:
missing tests that follow an existing pattern in the same package, fixtures,
repetitive repository/RPC wiring once the schema and RLS are already
committed, type/lint cleanup, UI wiring that only calls an already-tested
repository method, evidence-file updates for a run that already passed.

**Never delegable** — reserve for a frontier session: architecture and
domain modeling, RLS/tenant-isolation authorship, any migration touching
money/stock/tenant boundaries, payments, privacy, AI-authorization or
prompt/grounding design, an `FT-*` fidelity judgment call, any ambiguous
cross-system decision, or anything `PHASE.md`/a blueprint already flags as
needing a founder decision. If the cheap worker's own slice would touch one
of these, its instruction is to stop and leave a status note, not guess.

**Backend priority — cheapest usable capacity first, chosen by the frontier
agent itself, no scheduler:**

1. **Same-subscription light worker.** If the frontier seat is Claude Code,
   this is the Agent tool with `model: "haiku"` (`subagent_type:
"general-purpose"` is sufficient — it already has Bash/Edit/Write/Read).
   No script, no worktree tooling of its own: the frontier session creates
   the lane worktree itself (`git worktree add`, same convention as any
   other lane), points the agent at that directory with the identical
   bounded-task contract used below, waits for it (foreground, not
   background — the result is needed before continuing), then independently
   reruns the definition-of-done itself before trusting the commit. Verified
   live 2026-08-08: real commit, correct file scope, independently
   re-verified. Runs on the same Claude subscription as the frontier
   session itself, not separate API billing. If the frontier seat is Codex,
   the equivalent is `codex`'s own mini/light model under the same login —
   see `--provider subscription` below.
2. **Alternate subscription worker.** `pnpm paon:delegate --provider
subscription --model gpt-5.4-mini` (or the current light tier in
   `~/.codex/models_cache.json`) — Codex's own subscription, no OpenRouter.
   Verified live 2026-08-08 up to a real Codex usage-limit response; retry
   after the account's reset time once it's proven clean end-to-end.
3. **OpenRouter free.** Only a model confirmed to support `tools`/
   `tool_choice` over the Responses API — check
   `https://openrouter.ai/api/v1/models` before assuming one works.
   `openai/gpt-oss-20b:free` authenticated correctly but failed with
   `provider_incompatible` (`Server tool request failed`) in this codex
   build as of 2026-08-08 — do not assume it or any other free model works
   without re-verifying.
4. **Paid OpenRouter.** Only when a key with a real (non-zero) spend limit
   is explicitly configured — a `403 Key limit exceeded` from a
   deliberately zero-limit key is not a bug to route around, it is the
   founder disabling this tier on purpose.

Try tier 1; if its JSON `reason` is anything but a real implementation
failure (i.e. `quota_exhausted`, `provider_incompatible`,
`missing_credential`, `paid_fallback_disabled`), move to the next tier
without asking the founder. If every tier returns a capacity-shaped reason,
stop and report `blocked_capacity` rather than silently spending money on a
tier the founder didn't enable.

To delegate one via `pnpm paon:delegate` (tiers 2–4; tier 1 uses the Agent
tool directly, no script), the frontier session:

1. Picks one `PHASE.md` item, or an already-named gap inside one (its own
   "Not yet built"/non-goals text is usually the exact scope), that is fully
   `Delegable` per the list above.
2. Runs `pnpm paon:delegate -- --item <ID> --scope "<one bounded task,
one paragraph>" --model <model-id>` (see `scripts/paon-delegate.sh` for the
   full flag list — `--model` is required, never assumed). Default
   `--provider` is `openrouter` (pay-per-token, needs `OPENROUTER_API_KEY`);
   pass `--provider subscription` to run the worker on this machine's own
   `codex login` (ChatGPT/Codex subscription) instead — no key, no
   OpenRouter, subscription-covered usage. Either way pick the cheap/mini
   tier the provider actually serves, not a frontier-tier model.
   This alone creates or reuses an isolated `.claude/worktrees/` lane
   worktree on its own branch, installs dependencies, runs the worker
   sandboxed to that worktree with the exact bounded prompt above (nothing
   pasted by hand — the worker reads `AGENTS.md`/`PHASE.md` itself), waits
   for it, independently reruns the full definition-of-done inside the
   worktree regardless of what the worker claims, and prints one JSON
   result (`status`, `reason`, `branch`, `worktree`, `baseSha`, `resultSha`,
   `diffStat`, `verification`, `stopReason`). `reason` is the machine-readable
   field for backend selection: `success`, `non_delegable`,
   `invalid_credential`, `missing_credential`, `missing_model_config`,
   `paid_fallback_disabled`, `quota_exhausted`, `provider_incompatible`,
   `timeout`, `worker_made_no_commit`, or `implementation_failure` — use it
   to decide the next backend tier programmatically, never by re-parsing
   free-text stderr.
3. Reviews the resulting commit(s) — `git -C <worktree> log`/`diff` — like
   any other diff. `status: "blocked"` means the worker stopped itself on a
   non-delegable boundary per `stopReason`; `status: "failed"` means its
   commit (if any) did not survive independent re-verification. Either way,
   nothing outside that worktree's own branch was touched.
4. On acceptance, push and merge the worktree's branch per the multi-lane
   protocol above like any other lane. On rejection, ask the worker for a
   bounded correction (rerun the command with the same `--branch` to reuse
   the worktree) or abandon it.

Requires `OPENROUTER_API_KEY` in the environment (never committed) and the
`codex` CLI on `PATH`; the script fails fast and explains which is missing
rather than guessing. It writes one small additive profile,
`~/.codex/paon-worker.config.toml`, the first time it runs — it layers on
top of the machine's own `~/.codex/config.toml` and never edits that file.

**Recovery:** the worktree/branch is the entire blast radius. A cheap
worker that goes sideways is `git worktree remove --force` (or
`git reset --hard` to the lane's fork point) — nothing outside that branch
was ever touched, same guarantee any lane already gives.

**Default execution policy for an authorized `PHASE.md` item:** own the
never-delegable work yourself, delegate every bounded/settled-shape
remainder the instant it appears, review and independently re-verify each
result, and loop — delegate, review, continue — without stopping to ask the
founder to open a worker, relay output, pick a model, or approve continuing.
Keep going until the item is genuinely complete, or you hit a real founder
product decision, a missing external credential, an irreversible action, or
an architectural contradiction nothing in the repo resolves — those are the
only valid reasons to stop and surface something to the founder.

Do not accumulate delegable remainders. Delegate each one immediately once
its shape settles, rather than continuing frontier-owned work and batching
several remainders for later — a queued-but-undelegated remainder is
frontier time spent on work a worker could already be doing in parallel.
The one exception is when batching demonstrably reduces total work (e.g.
several remainders share one worktree/install/verification pass and
splitting them would just repeat that fixed cost) — batch only for that
reason, stated at the time, not by default.

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
