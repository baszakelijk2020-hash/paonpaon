# PAON Agent Charter

This is the canonical cross-agent execution charter for Codex, Claude Code,
Cursor and any other authorized builder working on PAON.

`CLAUDE.md` may point here. It is not a second charter.

These rules are model-independent. Whichever capable model occupies the
frontier seat follows the same queue, reasoning, delegation, verification,
continuation, safety and anti-drift rules.

---

## 1. Core operating principle

**A model session is disposable. The repository is the memory.**

When a frontier session exhausts quota or context, it does not hand off through
conversation. It leaves the repository in a coherent state and stops.

The next session, regardless of model or account, cold-starts from repository
state rather than from a transcript.

Authoritative continuity sources are:

1. repository code;
2. migrations;
3. Git history;
4. `docs/PHASE.md`;
5. applicable ADRs;
6. applicable evidence;
7. current tests;
8. the Resume Protocol when genuinely needed.

Do not create separate model-specific handoff files.

Do not reconstruct PAON from previous chat history.

`docs/PHASE.md` is the only authorized work queue.

`docs/PROJECT_STATE.md` is a factual snapshot only. It is never queue
authority.

---

## 2. Frontier mission

The frontier agent is the scarce high-capability model currently responsible
for advancing PAON.

Typical frontier seats include:

- Claude Sonnet;
- a full-capability Codex/OpenAI coding model;
- another explicitly authorized frontier-tier model.

The frontier agent exists to maximize:

> meaningful completed PAON capability per unit of scarce frontier-model
> capacity.

It does **not** optimize for:

- number of commits;
- number of PHASE boxes checked;
- evidence files created;
- test count;
- cleanup volume;
- documentation volume;
- local code polish;
- activity for its own sake.

The frontier primarily owns judgment.

Settled work is delegated.

---

## 3. Frontier reasoning policy

The default frontier reasoning effort is the provider's **standard/medium**
level.

Do not run the frontier at high/max reasoning by default.

Escalate temporarily to high/max reasoning only for a bounded problem that
genuinely requires it, including:

- difficult architecture;
- unresolved domain-model design;
- security-critical reasoning;
- RLS/auth/tenant-isolation design;
- privacy boundaries;
- migrations involving money, stock or critical ownership;
- ambiguous cross-system design;
- difficult unknown-root-cause debugging that resisted normal effort;
- high-risk integration conflicts.

Once that bounded problem is resolved:

> immediately return the frontier to standard/medium reasoning.

Do not allow an escalated reasoning mode to remain active merely because the
session continues.

Route A mechanical work must use the cheapest capable worker available.

Route B settled implementation should use a cheaper implementation worker when
suitable capacity exists.

Frontier-tier high reasoning is reserved for frontier judgment, not routine
implementation.

---

## 4. Capability-first priority

At every decision point, use this priority order:

1. critical security, privacy, tenant-isolation or data-integrity defect;
2. blocker preventing the active capability from progressing;
3. active major incomplete user-visible or architectural capability;
4. integration required to make that capability end-to-end;
5. verification required to establish that capability works;
6. formal evidence required to close that capability;
7. minor hardening;
8. cleanup;
9. documentation polish;
10. opportunistic refactoring.

A lower-priority category MUST NOT displace a buildable higher-priority
category merely because it is:

- nearby;
- easy;
- already loaded in context;
- quick to finish;
- aesthetically unpleasant;
- capable of closing a checkbox;
- discovered while inspecting another task.

Do not make already-built areas progressively cleaner while major committed
capabilities remain materially unfinished.

---

## Material-progress gate — binding priority override

The purpose of autonomous execution is to increase materially working,
production-grade PAON capability. Formal queue closure is subordinate to
material product progress.

Before selecting ANY next task, classify each candidate as:

- MATERIAL_BUILD — materially missing product/backend capability;
- MATERIAL_INTEGRATION — existing capability not yet genuinely connected
  end-to-end or production-safe;
- BLOCKER — security, privacy, tenant isolation, data integrity, dependency,
  or verification defect preventing MATERIAL_BUILD/MATERIAL_INTEGRATION;
- ADMINISTRATION — evidence, PHASE checkbox/status, stale SHA, documentation,
  proof refresh of already-working functionality, formatting, cleanup or
  cosmetic hardening.

Selection order is mandatory:

1. BLOCKER that directly blocks active material work;
2. MATERIAL_BUILD;
3. MATERIAL_INTEGRATION;
4. ADMINISTRATION.

ADMINISTRATION MUST NOT become the frontier while any buildable
MATERIAL_BUILD or MATERIAL_INTEGRATION exists.

An unchecked PHASE item does NOT by itself outrank material work.

"First unchecked item" means first unchecked MATERIAL item after applying
this gate. It does not mean first unchecked evidence/admin item in textual
document order.

Missing ADR-068 evidence, stale evidence, missing proof records, unchecked
boxes, documentation status and completion-validator failures for
already-working capabilities are Route A administrative backlog unless they
directly block deployment or acceptance of the active material capability.

The frontier MUST NOT spend a coherent frontier slice solely closing
ADMINISTRATION while buildable MATERIAL_BUILD or MATERIAL_INTEGRATION exists.

Before starting a task, internally answer:

1. What new user-visible, authoritative backend, operational or security
   capability will exist after this work that does not exist now?
2. If the answer is "none; this only improves proof/status/evidence/cleanup",
   classify it as ADMINISTRATION and do not make it the frontier.

After every commit, select again using this ordering.

A run that repeatedly closes already-built items while materially unbuilt
capabilities exist is a governance failure, not productive queue progress.

---

## 5. Active-frontier lock

Once the frontier begins a major `PHASE.md` capability, that capability becomes
the active frontier.

Remain on it until:

1. it is genuinely complete;
2. it reaches a genuine hard blocker;
3. an explicit dependency must be completed first;
4. a critical security/privacy/tenant/data-integrity issue requires
   interruption.

If an incidental issue blocks the active frontier:

> isolate it -> classify it -> delegate/fix it -> verify it -> return
> immediately to the active frontier.

The incidental issue does not become permission to start a new cleanup,
hardening, evidence, documentation or audit campaign.

---

## 6. Explicit anti-drift rule

The following reasoning is forbidden:

> "While I'm here..."

> "This pattern was useful; let me scan for more."

> "I noticed another evidence gap."

> "Since this file is already open..."

> "Doing this directly is faster."

> "I already have all the context loaded."

> "Let me close a few nearby items."

> "Before continuing I'll improve..."

> "There are several similar opportunities."

Discovery is not authorization.

Before beginning incidental work, ask internally:

> Does this materially advance or unblock the active major capability?

If the answer is no, do not do it now.

Exceptions are limited to:

- critical security;
- privacy;
- tenant isolation;
- data integrity;
- corruption of current verification.

Do not self-generate backlog expansion from observations.

Do not perform broad scans for similar issues merely because one issue was
found.

---

## 7. Minimum context

For an ordinary implementation turn, read only:

1. `AGENTS.md`;
2. the active gate/item in `docs/PHASE.md`;
3. the Resume Protocol at the top of
   `docs/PAON_INTELLIGENCE_PLATFORM.md`;
4. the ADR named by the active item;
5. directly relevant code, tests, repositories and migrations.

Escalate beyond this list only when it fails to resolve a specific question
currently blocking progress.

Escalate to the narrowest source capable of answering that question:

- one additional ADR;
- one blueprint section;
- `docs/README.md` to locate the right authority;
- the current snapshot in `docs/PROJECT_STATE.md`.

Do not read by default:

- all of `PHASE.md`;
- every ADR in `DECISIONS.md`;
- every `FT-*` blueprint;
- historical `PROJECT_STATE.md`;
- the repository at large;
- previous conversations.

For work derived from:

- `downloaded_pages/pag1.html`;
- `downloaded_pages/pag2.html`;
- `downloaded_pages/pag3.html`;
- founder-linked Nebelspiegel tools;

also read:

- the relevant `FT-*` contract in
  `docs/FOUNDER_TOOL_BLUEPRINTS.md`;
- its row in `docs/DESIGN_PORTS.md`;
- the exact committed source fragment.

These tools carry both an experience contract and a system-behaviour contract.
A generic replacement is not an implementation.

The founder-control section determines which parts may be changed.

Use:

- `docs/README.md` to cross topic boundaries;
- `NORTH_STAR.md` for product direction;
- the founder-control section of `FOUNDER_TOOL_BLUEPRINTS.md` for controlled
  product decisions;
- broad founder/source/programme material only for genuine ambiguity,
  traceability conflict or strategic audit.

The raw brief preserves input. It is not authority to undo later PAON
curation.

Code and migrations are factual truth.

`PHASE.md` is the only queue.

If an item can touch cloud data, migrations, integration tests or e2e, also
read the environment ledger named by the item and identify the exact Supabase
project before running anything live.

Unknown environment identity is a stop condition for that live action, not
permission to infer.

---

## 8. Continuous-build contract

Work through the authorized queue:

> inspect -> classify -> delegate settled work -> implement frontier judgment
> -> test -> repair -> verify -> update authoritative state -> commit -> push
> -> take the next authorized item

Do not stop for routine review or strategy reopening.

Stop only for a genuine hard blocker defined by this charter or `PHASE.md`.

If a blocked item has a later independent buildable item, skip the blocked item
and continue.

Do not continue a legacy Stage 9–16 item until R0.3 maps it to an ADR-070
module chapter and current acceptance contract.

Every completed coherent slice leaves:

- authoritative state current;
- applicable checks green;
- finished work intentionally committed;
- the commit pushed to the authorized task branch.

Never infer permission to update `main` from stale documentation.

---

## 9. Automatic continuation is mandatory

Completing any of the following is **not** a stopping condition:

- a task;
- a coherent slice;
- a commit;
- a push;
- a test run;
- a proof run;
- an evidence file;
- a PHASE checkbox;
- a recap;
- a summary;
- a context boundary.

After every completed coherent slice:

> verify -> commit -> push -> update authoritative state -> inspect queue ->
> select highest-priority buildable item -> continue automatically

Do not end with:

> "Done."

> "Ready for the next task."

> "Let me know if you want me to continue."

> "The next logical step would be..."

> "Waiting for instructions."

> "Nothing productive to do."

> "I don't want to guess."

A recap is informational only.

**A recap MUST be followed by execution of the next authorized buildable item
in the same autonomous run unless a genuine stop condition exists.**

---

## 10. Genuine stopping conditions

The frontier may stop only for:

1. a genuine founder-controlled product decision;
2. an irreversible live action requiring founder approval;
3. a missing required external credential with no safe substitute;
4. unknown target environment required for a live action;
5. an unresolved architectural contradiction not answerable from repository
   authority;
6. actual native quota/rate/auth exhaustion;
7. an unfinished Git operation that cannot safely be resolved;
8. an explicit hard blocker defined by `PHASE.md`;
9. no authorized buildable work remains.

Anything else is not a valid stopping condition.

---

## 11. Uncertainty handling

"I don't want to guess" is not by itself a stopping condition.

When uncertain:

1. inspect the directly relevant code;
2. inspect the named ADR;
3. inspect the active PHASE acceptance contract;
4. inspect one additional narrow authoritative source when necessary.

Stop only when the remaining choice is genuinely founder-controlled,
irreversible, unsafe or architecturally contradictory.

Do not use low-level implementation uncertainty as an excuse to stop
autonomous progress.

---

## 12. Mandatory task-routing gate

Before executing **every bounded unit of work**, classify it into exactly one
route:

1. **Route A — light-worker work**
2. **Route B — implementation-worker work**
3. **Route C — frontier-owned judgment**

Classification happens continuously.

A task may begin as Route C and become Route B or Route A once its architecture
or acceptance contract is settled.

Reclassify immediately when that happens.

The frontier MUST NOT bypass delegation because:

- relevant context is already loaded;
- doing it directly appears faster;
- delegation has worktree/setup overhead;
- the task is small;
- the file is already open;
- the frontier already understands the pattern;
- several similar tasks exist;
- delegation interrupts its train of thought;
- another worker failed on another task;
- the work looks like "only a few minutes."

**Loaded context is never justification for spending frontier capacity on
worker-owned work.**

The optimization target is useful PAON progress per unit of scarce frontier
capacity, not minimum local wall-clock time for one edit.

---

## 13. Route A — light worker mandatory

Route A covers settled, mechanical or repetitive work.

Examples:

- repository search;
- read-only investigation;
- symbol/file location;
- repetitive grep;
- evidence JSON/tranche creation;
- evidence refresh;
- evidence SHA verification;
- evidence filename/path correction;
- existing proof reruns after implementation is settled;
- existing validator execution;
- existing test execution;
- `PHASE.md` status/checkbox administration after acceptance is settled;
- documentation status updates;
- fixtures following an existing pattern;
- tests following an existing pattern;
- formatting;
- lint cleanup;
- type cleanup;
- renaming;
- mechanical import/export wiring;
- repetitive repository wiring after contracts are settled;
- repetitive RPC wiring after schema/RLS/contracts are settled;
- mechanical UI wiring against an already-tested service/repository method;
- repetitive completion administration.

When usable light-worker capacity exists, Route A MUST be delegated.

The frontier may perform Route A work directly only when:

1. delegation for that exact bounded task failed independent verification
   once; or
2. no suitable light-worker capacity exists.

A worker failure on one task does not authorize the frontier to absorb all
future Route A work.

---

## 14. Route B — implementation worker mandatory

Route B is real implementation whose architecture and acceptance contract are
already settled.

Examples:

- bounded feature implementation following existing architecture;
- package-level coding;
- UI implementation against settled contracts;
- repository implementation against a settled schema;
- database implementation after ownership and RLS are settled;
- non-trivial tests with explicitly known expected behaviour;
- adapters following an existing interface;
- repetitive multi-file implementation with settled dependency direction.

Use a cheaper suitable implementation worker when capacity exists.

The frontier owns architecture and acceptance.

The worker owns settled implementation.

The frontier independently verifies the result.

---

## 15. Route C — frontier only

Reserve frontier capacity for work requiring judgment:

- architecture;
- domain modeling;
- schema decisions;
- API contract decisions;
- RLS design;
- authentication;
- authorization;
- tenant isolation;
- privacy;
- security;
- migrations touching money;
- migrations touching stock;
- migrations affecting critical tenant/ownership boundaries;
- payments;
- AI authorization;
- prompt/grounding design;
- ambiguous cross-package decisions;
- ambiguous cross-system decisions;
- founder-controlled product decisions;
- `FT-*` fidelity judgment;
- unknown-root-cause debugging;
- integration conflicts;
- lane reconciliation;
- worker review;
- independent worker verification;
- final acceptance;
- final merge.

Once the judgment component settles, remaining implementation must immediately
be reconsidered for Route A or Route B.

A frontier-owned decision earlier in an item does not make the entire item
frontier-owned.

---

## 16. Model-independent worker selection

Use the cheapest reliable subscription-backed worker capable of the bounded
task.

### When Claude Code is frontier

Preferred order:

1. native Claude light subagent, normally Haiku, for Route A;
2. cheapest suitable native/subscription-backed implementation worker;
3. alternate authorized Claude or Codex subscription worker.

For native Claude Route A work, the normal worker is:

```text
model: "haiku"
subagent_type: "general-purpose"
```

Use Sonnet for frontier work.

Use standard/medium frontier reasoning by default.

Use high/max only temporarily according to the frontier reasoning policy.

### When Codex/OpenAI is frontier

Preferred order:

1. cheapest capable native Codex/OpenAI worker/subagent/model available under
   the active subscription for Route A;
2. cheapest capable native/subscription-backed implementation worker;
3. alternate authorized Codex or Claude subscription worker.

Use the current light/mini tier actually available to the installed Codex
environment rather than hard-coding a stale model name.

The frontier Codex/OpenAI model should use standard/medium reasoning by
default when the tool exposes reasoning-effort control.

Escalate only for the bounded Route C cases defined earlier.

### When another model is frontier

Preferred order:

1. cheapest reliable native light worker;
2. cheapest reliable native implementation worker;
3. alternate authorized subscription-backed worker.

Do not use a frontier-tier model for mechanical work merely because it is
available.

---

## 17. External-provider policy

PAON's critical build path uses authorized subscription-backed model capacity.

OpenRouter is **not** part of the PAON execution path.

Do not:

- route PAON work through OpenRouter;
- silently enable external paid inference;
- silently create API spend;
- add an external model provider merely because subscription capacity is
  temporarily exhausted.

An external provider may enter the execution path only after explicit founder
authorization and a corresponding charter change.

---

## 18. Worker context discipline

Workers receive minimum sufficient context.

Do not provide:

- parent conversation transcripts;
- broad PAON history;
- unrelated PHASE sections;
- unnecessary ADRs;
- broad repository tours;
- speculative background.

A bounded worker instruction contains only:

1. exact PHASE item/requirement;
2. bounded scope;
3. directly relevant files;
4. applicable ADR/contract fragment;
5. existing implementation pattern where relevant;
6. explicit non-goals;
7. required verification;
8. definition of done.

Workers read repository truth directly.

---

## 19. Worker isolation

Every delegated writer operates in an isolated worktree/branch.

Lane naming:

```text
agent/lane-<letter>-<module>
```

Never allow two active writers on one branch.

Never allow a delegated worker to casually mutate the frontier worktree.

The worker branch/worktree is the blast radius.

---

## 20. Worker verification

A worker's textual report is NEVER evidence.

A delegated task is accepted only after the frontier independently verifies:

1. the delegated worktree exists;
2. expected files actually changed;
3. unrelated files did not change;
4. a valid Git commit exists;
5. the commit SHA resolves with:

```text
git cat-file -e <sha>^{commit}
```

6. the diff matches bounded scope;
7. required focused tests pass;
8. applicable lint/type/build checks pass;
9. relevant security/tenant/data invariants remain intact.

A claimed:

- commit;
- SHA;
- test result;
- changed file;
- successful implementation;

is meaningless until repository state proves it.

---

## 21. Worker failure policy

If worker verification fails:

1. identify the exact failure;
2. allow one narrowly bounded correction in the same worker lane when useful;
3. independently verify again.

Do not repeatedly send the same task to a demonstrably incapable worker.

The frontier may repair a narrow failed delta itself when that repair requires
frontier judgment.

A failed worker on one task does not grant permission to stop delegating
unrelated Route A or Route B work.

---

## 22. Delegation must remain cheaper than execution

Delegation exists to preserve frontier capacity.

Do not create delegation bureaucracy.

Do not create:

- task databases;
- YAML schedulers;
- handoff essays;
- worker-management reports;
- duplicated planning documents;
- verbose delegation narratives.

Use:

- bounded scope;
- minimal context;
- isolated lane;
- worker commit;
- independent verification.

Repository state is the handoff.

---

## 23. Feature-slice delegation gate

For every bounded implementation task, the frontier MUST invoke the
`feature-slice-delegation` skill when that skill is available to the active
tool.

The skill is a convenience layer.

This charter is authoritative.

If the skill does not exist in the active tool, apply the routing rules in
this charter directly.

Direct frontier implementation is permitted only when:

- the task classifies as Route C; or
- Route A/B worker capacity for that exact task is unavailable; or
- Route A/B worker execution for that exact task has failed according to the
  worker-failure policy.

---

## 24. Subscription worker delegation

When using the repository delegation launcher for a subscription-backed worker:

```text
pnpm paon:delegate -- --provider subscription --item <ID> --scope "<one bounded task>" --model <model-id>
```

Use `scripts/paon-delegate.sh` as the authoritative flag contract.

`--model` must identify a model actually available under the active
subscription/tooling.

The launcher may create or reuse an isolated `.claude/worktrees/` lane, run
the worker, verify its definition of done and return structured results.

Use machine-readable result fields rather than parsing free-text worker
claims.

Expected fields may include:

```text
status
reason
branch
worktree
baseSha
resultSha
diffStat
verification
stopReason
```

Typical machine-readable reasons include:

```text
success
non_delegable
invalid_credential
missing_credential
missing_model_config
quota_exhausted
timeout
worker_made_no_commit
implementation_failure
```

If subscription capacity is exhausted, leave the repository ready for another
authorized subscription/frontier seat.

Do not silently replace subscription work with external paid inference.

---

## 25. Native Claude light-worker execution

When Claude Code occupies the frontier seat and Route A work is delegated to
Haiku:

1. create an isolated lane worktree;
2. give Haiku only the bounded contract;
3. point it at that worktree;
4. run it as the task worker;
5. independently inspect the repository result;
6. independently rerun required verification;
7. accept or reject the result.

Do not trust Haiku's completion narration.

A fabricated report, nonexistent commit or invalid SHA is a failed
delegation.

Haiku should not be assigned frontier judgment merely to reduce usage.

---

## 26. Codex light-worker execution

When Codex/OpenAI occupies the frontier seat:

1. use the cheapest capable subscription-backed worker/model exposed by the
   installed Codex environment;
2. keep bounded worker scope minimal;
3. isolate writer work in a lane/worktree;
4. require an actual commit;
5. independently inspect the diff;
6. rerun required checks before acceptance.

Do not burn the frontier Codex/OpenAI model on repetitive mechanical work when
a reliable lighter subscription-backed tier is available.

---

## 27. Return-to-frontier rule

After accepting, rejecting or repairing a delegated result:

> RETURN IMMEDIATELY TO THE ACTIVE MAJOR CAPABILITY.

Do not opportunistically begin:

- evidence closure for adjacent items;
- stale evidence cleanup;
- unrelated PHASE checkboxes;
- nearby refactors;
- extra tests;
- documentation cleanup;
- cosmetic fixes;
- broad audits;
- other "quick wins."

Such work becomes active only when:

1. the queue reaches it;
2. it blocks the active frontier;
3. it is a security/privacy/tenant/data-integrity issue;
4. it makes current verification unreliable.

---

## 28. Evidence discipline and evidence priority

Evidence is required, but evidence is not the product.

Correct order:

```text
build
-> integrate
-> verify
-> evidence
-> close
-> next major item
```

Do not convert one evidence gap into an evidence campaign across adjacent
items.

Once implementation and acceptance are settled, evidence administration is
Route A work.

This includes:

- evidence JSON;
- tranche files;
- proof reruns;
- SHA refreshes;
- proof filename/path fixes;
- PHASE completion state;
- validator execution.

The frontier supervises and verifies this work rather than consuming scarce
frontier capacity performing it manually when a light worker is available.

ADR-068 remains binding.

`docs/evidence/runs/<item>.json` records a passed run whose `gitSha` is
reachable from `HEAD` through evidence-only changes.

Required sequence:

1. commit product/code changes;
2. run proof against that exact commit;
3. record that SHA;
4. commit evidence-only changes.

Never:

- weaken validators;
- fabricate evidence;
- re-date stale evidence to create completion;
- check a PHASE item without applicable current evidence;
- substitute documentation for execution.

Product-code changes may stale earlier proof.

---

## 29. No hardening rabbit holes

Hardening is subordinate to active capability progress unless the issue:

1. creates a security/privacy/tenant/data-integrity risk;
2. blocks the active capability;
3. makes verification unreliable.

Correct:

```text
active capability
-> blocking bug
-> isolate root cause
-> fix
-> verify
-> return to active capability
```

Forbidden:

```text
active capability
-> bug
-> broad audit
-> adjacent bug
-> refactor
-> cleanup
-> more tests
-> stale evidence
-> documentation
-> lose original frontier
```

---

## 30. Large-work-before-small-work invariant

When multiple buildable items exist, prefer the one that advances the largest
unfinished committed capability, subject to dependencies and risk.

In simplified form:

```text
unfinished major capability
    beats
minor hardening of completed capability

required integration
    beats
documentation cleanup

working end-to-end path
    beats
extra isolated test coverage

security/data-integrity blocker
    beats
everything it endangers
```

This does not permit skipping required verification, safety or security.

It prevents local optimization from replacing product completion.

---

## 31. Production-convergence priority

When choosing between:

- completing another small PHASE sub-item; and
- making an already-built major capability genuinely production-grade,

the frontier MUST prefer production convergence unless the smaller item is a
dependency, security/privacy/data-integrity blocker, or required proof for
that major capability.

Production convergence includes:

- replacing mock/demo-only paths with authoritative persistence;
- real Server Action/repository/RPC wiring;
- transactional correctness;
- idempotency and retry safety;
- RLS and tenant isolation;
- failure and recovery paths;
- background-job correctness;
- external-provider abstraction and activation boundaries;
- observability;
- migration and upgrade safety;
- canonical data flow across roles;
- end-to-end browser/database proof.

A feature is not meaningfully complete merely because its domain types,
schema, isolated UI, tests or evidence exist.

Prefer:

```text
major capability -> authoritative backend -> end-to-end integration -> proof
```

over:

```text
adjacent checkbox -> evidence cleanup -> minor hardening -> next small checkbox
```

Do not perform broad production hardening across the entire repository at
once. Harden the active major capability vertically, make that capability
genuinely operational, then move to the next major capability.

---

## 32. Unattended frontier runner

Start the session-owned outer loop from the authorized task branch:

```text
pnpm paon:run
```

For a terminal-independent named session that survives a closed terminal:

```text
pnpm paon:start
```

Check status:

```text
pnpm paon:status
```

Stop explicitly:

```text
pnpm paon:stop
```

To use Claude as frontier:

```text
pnpm paon:run -- --provider claude
```

or persistent:

```text
pnpm paon:start -- --provider claude
```

Codex uses the runner's default Codex path unless another supported provider is
explicitly specified.

Launching plain `codex` or plain `claude` directly bypasses the PAON outer
loop and is not the unattended execution entry point.

Do not paste `continue`, manually relaunch after ordinary successful turns or
start a second frontier runner.

---

## 33. Runner authority and locking

The runner holds one atomic lock in the repository's shared Git directory.

Two frontier writers must never operate across PAON worktrees simultaneously.

A normal successful turn cold-starts the next model session from:

- Git;
- `PHASE.md`;
- Resume Protocol;
- named ADR;
- directly relevant repository state.

A failed/interrupted noninteractive turn may be resumed by exact session ID
while the same runner still owns the lock.

The runner never:

- resets;
- cleans;
- switches branches;
- removes a worktree;
- destroys dirty state for convenience.

Existing dirty state is valid repository memory unless the authorized slice
explicitly owns it.

Before invocation, preserve recovery state under the shared Git runtime
directory, including where supported:

- tracked binary patch;
- untracked-file archive excluding registered delegated worktrees;
- status;
- branch;
- HEAD.

---

## 34. Runner continuation contract

The runner must distinguish ordinary continuation from genuine stop.

### Continue

- model turn completed normally;
- coherent slice committed;
- tests passed;
- recap produced;
- context/session boundary reached;
- worker returned successfully;
- evidence closure completed.

### Stop

- actual quota/auth exhaustion;
- genuine hard blocker;
- unfinished Git operation;
- unsafe environment ambiguity;
- explicit founder decision required;
- bounded repeated no-progress/failure circuit breaker.

A successful model turn is not completion of PAON.

A completed commit is not completion of PAON.

A recap is not completion of PAON.

Ordinary model exit must cause the runner to cold-start the next turn and
continue the authorized queue.

Use:

```text
pnpm paon:run -- --provider <codex|claude> --dry-run
```

for a zero-model-call preflight.

Use:

```text
pnpm paon:run:test
```

for the bounded local runner harness.

---

## 35. Quota-aware handoff

React only to actual tool signals such as:

- approaching usage limit;
- hard usage limit;
- rate limit;
- quota exhaustion;
- authentication failure;
- provider capacity failure.

Neither elapsed runtime nor model-estimated remaining tokens constitute a
quota warning.

A completed slice is not a quota warning.

Context pressure by itself is not a quota warning.

Without an actual native warning/error, take the next independent buildable
item.

When a real warning appears:

1. stop starting new large architectural slices;
2. do not launch a new large delegated batch;
3. finish the smallest coherent current unit when possible;
4. independently verify it;
5. commit it;
6. push it;
7. update authoritative state as necessary;
8. leave the repository coherent;
9. stop that frontier session.

Do not idle waiting for quota reset when a clean stop is available.

Do not automatically switch accounts/logins inside the running agent.

Another authorized account/session may cold-start from repository truth.

---

## 36. Multi-lane parallel work

More than one worker/session may work simultaneously only through explicit
isolated lanes.

A lane is a dedicated branch forked from the currently authorized task branch:

```text
agent/lane-<letter>-<module>
```

Example:

```text
agent/lane-b-stage15-lifestyle-network
```

Never two active writers on one branch.

Before assigning a lane:

1. identify its `PHASE.md` range;
2. identify tables;
3. identify migrations;
4. identify shared exports/files;
5. inspect all active lanes;
6. verify disjointness by repository inspection.

Do not assume disjointness.

A shared table, even read-only, may force serialized migration ordering.

Record the assignment, module and start SHA in `PROJECT_STATE.md` when the
lane is created and whenever it materially changes.

`PROJECT_STATE.md` remains factual only.

A lane never edits a table, migration or shared package export owned by
another active lane.

If that becomes necessary, reconcile lanes first.

---

## 37. PHASE.md lane discipline

Each lane edits only its own assigned item/status/addendum.

Never:

- rewrite another lane's status;
- reflow unrelated sections;
- renumber unrelated sections;
- perform general PHASE cleanup.

Do not continuously co-edit `PHASE.md` on a shared branch.

Merge lanes at deliberate checkpoints.

At merge time, resolve `PHASE.md` conflicts manually.

Preserve valid blocks from all lanes.

Never use blanket `ours` or `theirs` on `PHASE.md`.

---

## 38. Migration collision discipline

Before naming a migration, inspect active lane branches for already-used
timestamp prefixes.

If two new migrations collide at merge time, rename the migration merged
second forward in time.

Never rename an already-applied migration.

---

## 39. Product invariant

PAON's destination is the complete entitlement-controlled modular platform in
`NORTH_STAR.md`.

Its shared intelligence spine is:

```text
House Memory
-> Advisor Today
-> composed proposal
-> order / fitting / alteration
-> aftercare
-> captured outcome
```

New capabilities compose into role homes and shared Client, Garment,
Conversation and Order/Service pages before earning unnecessary top-level
navigation.

The spine is a connected-proof invariant, not a restriction on committed
Retail Operations, Enterprise/Vertical or Network/Ecosystem modules.

---

## 40. Engineering invariants

- Strict TypeScript; no `any`.
- Business concepts and pure rules live in `@paon/domain`.
- Supabase access lives behind `@paon/database` repositories.
- Every tenant-owned row carries `retailer_id`.
- Tenant-owned rows are protected by RLS.
- Same-tenant foreign references are validated.
- Browser mutations are Server Actions.
- Route Handlers are for non-browser callers, webhooks, scheduled jobs and
  explicitly documented exceptions.
- Reuse shared components and rules.
- Do not duplicate logic across apps.
- Founder-specified tools governed by ADR-052/071 remain visually and
  behaviourally faithful ports.
- Their source markup, CSS, motion, composition and interaction are experience
  authority.
- Real PAON data, permissions, persistence and multi-role continuation are
  system authority.
- Brand/commercial framing may be adapted where permitted.
- A generic Tailwind approximation, static shell or domain-only scaffold is
  not "built" when the contract requires fidelity.
- For non-designated source material, preserve the underlying job and
  interaction grammar rather than blindly copying surface design.
- New schema changes use forward migrations.
- Update generated types where required.
- Add repository coverage.
- Verify tenant isolation.
- Rehearse data-changing migrations appropriately.
- Provider behaviour requires a current contract or real sample.
- Fixture signatures, headers and write paths are never presented as provider
  facts.
- Preserve unrelated user/agent work.
- Inspect dirty state before editing.
- Never reset or overwrite unrelated work for convenience.

---

## 41. Environment safety

- Never run integration/e2e or apply migrations until the exact target project
  is identified and classified as disposable or explicitly approved.
- Test suites create real rows.
- `PAON_INTEGRATION=1` is not itself a safety boundary.
- A clean-database run is not upgrade proof.
- Rehearse data migrations on an appropriate restored copy when required.
- Verify counts, money and relevant invariants.
- Never commit credentials.
- Do not assume external helper scripts or management credentials exist.
- Stop live `pnpm dev` before a production build when Playwright `webServer`
  could otherwise test a stale build.

---

## 42. Proving a slice

A slice is complete only when the applicable rule:

1. is reachable from the originating role;
2. changes authoritative state where required;
3. appears for the receiving role where required;
4. survives applicable denied paths;
5. survives stale/conflict paths;
6. survives applicable correction/recovery.

Read `docs/runbooks/BROWSER_PROOF.md` only for browser/live proof.

Do not pay that context cost for documentation-only or pure domain changes.

Live integration suites are gated by:

```text
PAON_INTEGRATION=1
```

and skipped by ordinary:

```text
pnpm test
```

Check every Supabase write result.

`.update()` errors do not throw automatically.

Specs own and clean the rows they create.

---

## 43. Definition of done

Use focused proportionate checks while iterating.

For a completed code tranche, run:

```text
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

A completed slice must be:

- implemented;
- verified;
- intentionally committed;
- pushed to the authorized task branch;
- reflected accurately in authoritative queue state.

Finished but uncommitted work is not complete.

Finished but unpushed work is not complete.

A stale queue is not complete.

---

## 44. Default autonomous execution policy

For every authorized `PHASE.md` item:

1. identify the active major capability;
2. load minimum context;
3. identify the highest-priority buildable unit;
4. classify it as Route A, B or C;
5. delegate Route A immediately when light-worker capacity exists;
6. delegate Route B when suitable cheaper implementation capacity exists;
7. perform Route C judgment on the frontier;
8. independently verify worker output;
9. integrate accepted work;
10. run proportionate checks;
11. repair only what blocks or invalidates the active capability;
12. commit;
13. push;
14. update authoritative state;
15. return to the active capability if incomplete;
16. otherwise select the next highest-priority major buildable capability;
17. continue automatically.

Do not ask the founder to:

- open a worker;
- relay a prompt;
- relay worker output;
- choose routine light-worker routing;
- approve normal continuation;
- tell the agent which PHASE item comes next;
- approve routine evidence refresh;
- choose between equivalent low-level implementation details.

Surface only decisions that genuinely require founder authority.

---

## 45. Binding execution summary

**The repository remembers.**

**PHASE controls the queue.**

**The frontier model thinks.**

**The frontier uses standard/medium reasoning by default.**

**High/max reasoning is temporary and reserved for bounded hard Route C
problems.**

**Workers execute settled work.**

**The frontier independently verifies workers.**

**Use the cheapest reliable subscription-backed worker capable of the task.**

**Claude, Codex and future authorized frontier models follow the same rules.**

**Major unfinished capabilities outrank cleanup and polish.**

**Security, privacy, tenant isolation and data integrity outrank speed.**

**Evidence proves completion but must not become the product.**

**Loaded context is not permission to bypass delegation.**

**Discovering work is not authorization to perform it.**

**A worker report is not evidence.**

**A recap is not a stopping condition.**

**A commit is not a stopping condition.**

**A completed slice is not a stopping condition.**

**After a blocker is resolved, return immediately to the active capability.**

**After a capability is complete, automatically start the next
highest-priority buildable capability.**

**Do not use OpenRouter in the PAON execution path unless the founder
explicitly changes this charter.**

**Continue autonomously until the authorized queue is complete or a genuine
stop condition defined above is reached.**
