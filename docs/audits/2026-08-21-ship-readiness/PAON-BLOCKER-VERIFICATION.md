# PAON Ship-Blocker Independent Verification

Date: 2026-08-21
Scope: Independently re-verify every claim in `PAON-SHIP-BLOCKERS.md` (the 19-agent
audit workflow's output). That audit explicitly warned several of its own findings
were unverified. This pass re-checks each one against repository truth, live
production HTTP responses, actual source code, and direct browser reproduction —
not against any prior agent's conclusion.

No application code, schema, RLS, or credentials were modified during this pass.
No secret values are printed anywhere below.

---

## #1 — Supabase credential exposure ("21 days")

**CLAIM:** "Credential exposed in chat 2026-08-01 in Supabase secret key,"
21 days unrotated, immediate-compromise P0.

**INDEPENDENT TEST:** Searched `git log --all -p -- "*.env*"` for any actual secret
value ever committed; searched all of `docs/` (not just the audit's own output) for
the origin of this claim; read the `docs/NIGHT_LOG.md` entries from 2026-08-01
directly; checked `.claude/` for any pasted key.

**EVIDENCE:**

- No `.env.local` file, and no actual secret value, appears in git history at any
  commit — only `.env.example` placeholder files were ever tracked.
- The claim is **not** an audit-agent invention: it traces to
  `docs/ENVIRONMENTS.md:71-75`, which states in the founder's own operating
  document that "the Supabase secret key was pasted into a chat transcript on
  2026-08-01 and must be rotated." An earlier, now-removed `PROJECT_STATE.md`
  (commit `1d03985a`) carried the same line.
- No chat log, screenshot, commit SHA, or other artifact substantiates the claim —
  it is a recorded assertion, not something this repository can independently
  prove or disprove.
- `docs/NIGHT_LOG.md`'s actual 2026-08-01 entries describe an unrelated database
  privilege bug (append-only tables being fully writable), not a credential leak.

**RESULT: UNKNOWN**
Not a hallucination (it's a real line in `ENVIRONMENTS.md`), but not independently
provable either. There is no way from repo evidence alone to confirm whether an
exposure really happened, whether it's still unrotated, or whether it was already
handled and the doc simply never got updated.

**SHIP IMPACT:** If true, this is a real P0. Rotating a Supabase service-role key
is cheap (minutes) relative to the cost of being wrong in either direction — treat
as "rotate as a precaution" rather than "confirmed live incident," and ask the
founder directly what the 2026-08-01 event actually was.

**CONFIDENCE:** N/A (unknown by design — no evidence exists to rate)

---

## #2 — Production schema mismatch (customer app HTTP 500)

**CLAIM:** Customer app's profile step 500s because production DB is missing
`entity_metadata_assignments`; migration `20260810000000_add_entity_metadata_assignments.sql`
exists but isn't applied.

**INDEPENDENT TEST:** Directly curled the live production URL (not a report from
another agent). Checked whether the cited migration filename actually exists.
Checked `docs/DEPLOYMENT.md` for an independent, pre-existing admission of this
same issue.

**EVIDENCE:**

```
$ curl -s -o /dev/null -w "%{http_code}\n" https://paonpaon-customer.vercel.app/r/maison-dubois
500
```

This was reproduced live, right now, by this session — not inferred.

`docs/DEPLOYMENT.md` (top of file, dated 2026-08-02, pre-existing and independent
of the ship-readiness audit) already documents this exact incident: "the customer
production URL now returns HTTP 500 because deployed code expects
`entity_metadata_assignments`, which its older database schema does not contain."

**Citation correction:** the exact migration filename the audit cited
(`20260810000000_add_entity_metadata_assignments.sql`) **does not exist** in
`supabase/migrations/`. The real table is created by
`supabase/migrations/20260729174939_create_metadata_foundation.sql` and is used
extensively across the codebase (repositories, generated types, e2e specs). So the
audit fabricated the specific filename, but the underlying fact — production is on
an older schema that predates this table, and the customer app 500s because of
it — is real and independently reproduced.

**RESULT: CONFIRMED**

**SHIP IMPACT:** Production customer app is down right now for at least this route.
Revenue-blocking, matches the founder's own `DEPLOYMENT.md` admission.

**REPRODUCTION STEPS:**

```
curl -s -o /dev/null -w "%{http_code}\n" https://paonpaon-customer.vercel.app/r/maison-dubois
# → 500
```

**CONFIDENCE: HIGH**

---

## #3 — No error tracking / production observability

**CLAIM:** No Sentry, no error tracking; production failures invisible.

**INDEPENDENT TEST:** Grepped every `package.json` in the monorepo for Sentry/APM
packages; checked for React error boundaries (`error.tsx`); checked Server Action
and middleware error handling for any logging path; checked Vercel-native
observability config.

**EVIDENCE:**

- Zero `@sentry/*`, LogRocket, Datadog, Better Stack, Axiom, Highlight,
  `@vercel/analytics`, or `@vercel/speed-insights` in any `package.json`.
- No `error.tsx` (React error boundary) exists in any of the three apps.
- `apps/admin/middleware.ts` handles auth/Supabase errors without logging them
  anywhere durable.
- `docs/DEPLOYMENT.md`'s own troubleshooting section requires manually pulling
  Vercel logs via CLI to debug a white screen — i.e., the founder's own
  documentation confirms there is no alerting, only reactive manual log pulls.

**RESULT: CONFIRMED**

**SHIP IMPACT:** The HTTP 500 confirmed in #2 would be invisible to operators
unless someone manually checks logs. Compounds every other blocker's severity.

**REPRODUCTION STEPS:** `grep -r "@sentry" **/package.json` → no matches;
`find apps -name error.tsx` → no matches.

**CONFIDENCE: HIGH**

---

## #4 — Demo-login reachable in production

**CLAIM:** `NEXT_PUBLIC_DEMO_LOGIN=1` set on all three production Vercel projects;
one-click persona login live with real data.

**INDEPENDENT TEST:** Curled all three production `/login` pages directly and
grepped the returned HTML for demo-login UI markers.

**EVIDENCE:**

```
$ curl -s https://paonpaon-admin.vercel.app/login    | grep -io "demo.login\|persona"
Demo login
persona
$ curl -s https://paonpaon-retailer.vercel.app/login | grep -io "demo.login\|persona"
Demo login
persona
$ curl -s https://paonpaon-customer.vercel.app/login | grep -io "demo.login\|persona"
Demo login
persona
```

`docs/DEPLOYMENT.md` independently documents this as a known, already-flagged risk:
"Remove that variable on every project before any real retailer data exists — it
signs anyone straight in."

**RESULT: CONFIRMED**

**SHIP IMPACT:** Real, live, currently reproducible. Whether it's dangerous depends
on whether real customer/retailer data exists yet in that Supabase project — if
none does yet, impact is currently theoretical but must be disabled before it does.

**REPRODUCTION STEPS:** `curl -s https://paonpaon-admin.vercel.app/login | grep -i "demo login"`

**CONFIDENCE: HIGH**

---

## #5 — Migration / rollback readiness

**CLAIM:** 249 migrations never applied to production, no rollback procedure, no
rehearsal.

**INDEPENDENT TEST:** Counted actual migration files; read `docs/DEPLOYMENT.md`,
`docs/ENVIRONMENTS.md`, and CI workflow files for any migration-application step;
searched for destructive SQL statements; searched for rollback/rehearsal docs.

**EVIDENCE:**

- `ls supabase/migrations | wc -l` → 249, exact match.
- No CI job applies migrations to production (`supabase db push` does not appear
  in any GitHub Actions workflow); deploy jobs only push the Vercel apps.
- `docs/ENVIRONMENTS.md` explicitly and deliberately blocks this: "The original
  PAON project is on an older schema and must not receive the migration chain
  until an approved restore of its actual data proves row counts, backfills,
  stock, money, RLS and rollback/recovery." This is a pre-existing, intentional
  safeguard, not a newly discovered gap.
- `docs/runbooks/STOCK_UPGRADE_REHEARSAL.md` exists but is explicitly local-only:
  "must never target the protected original project directly."
- No `DROP`/`ALTER COLUMN...TYPE`/`TRUNCATE` found at statement start across all
  249 migrations — they are append-only in practice, which lowers (but does not
  eliminate) risk.
- No downgrade/rollback path is documented anywhere.

**RESULT: CONFIRMED** (as NOT REHEARSED; classified UNSAFE for "push all 249 blind,"
not for the migrations' own content, which is append-only)

**SHIP IMPACT:** Directly blocks safely fixing #2 in production. This is already a
known, intentional stop-sign in `ENVIRONMENTS.md` — not new information, but
correctly still a blocker until a rehearsed restore happens.

**CONFIDENCE: HIGH**

---

## #6 — Seven silent failure modes in admin app

**CLAIM:** 7 admin Server Actions return `Promise<void>` with no error surfaced to
the operator.

**INDEPENDENT TEST:** Read each cited function's actual current source, its
call site, and the UI component that invokes it, to determine whether errors are
caught and rendered anywhere.

**EVIDENCE (per function):**

| #   | Function                             | Result                          | Evidence                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `setRetailerStatus()`                | CONFIRMED                       | `retailers/[id]/actions.ts:238-251` returns void, no try/catch, no UI error state. (Note: claim that "storefront stays accessible when suspended" is **inaccurate** — storefront gating checks `retailer.status !== "active"` independently in `route.ts:325` and works correctly. The real gap is only that the admin never learns if the suspend/activate write itself failed.) |
| 2   | `resendStaffInvite()`                | CONFIRMED                       | `retailers/[id]/actions.ts:253-272`, unguarded `admin.auth.admin.inviteUserByEmail()`, void return, no UI feedback.                                                                                                                                                                                                                                                               |
| 3   | `updateProspectStage()`              | CONFIRMED                       | `prospects/actions.ts:70-82`, void, no error handling, plain form submit.                                                                                                                                                                                                                                                                                                         |
| 4   | `setDemoPublication()`               | CONFIRMED                       | `prospects/[id]/studio/actions.ts:319-328`, void, no error handling.                                                                                                                                                                                                                                                                                                              |
| 5   | `updateInquiryStatus()`              | CONFIRMED                       | `inquiries/actions.ts:12-23`, void, no error handling.                                                                                                                                                                                                                                                                                                                            |
| 6   | `setDemoLoginsActive()`              | CONFIRMED (different mechanism) | `demo-mode/actions.ts:44-65` actually **throws** unhandled rather than failing silently — a crash, not silence, but still zero graceful operator feedback.                                                                                                                                                                                                                        |
| 7   | `processWardrobeVisualizations` cron | **FALSE ALARM**                 | `api/cron/process-wardrobe-visualizations/route.ts:116-214` has proper per-job try/catch, marks failed jobs, counts `{claimed, succeeded, failed}`, and returns it in the JSON response. Partial failures ARE monitored.                                                                                                                                                          |

**RESULT: CONFIRMED for 6 of 7; FALSE ALARM for 1 (cron job)**

**SHIP IMPACT:** Real operational-blindness risk for the 6 confirmed items —
retailer suspension, staff invites, sales-pipeline tracking, demo publishing, and
lead triage can all fail with zero operator feedback.

**REPRODUCTION STEPS:** Read `apps/admin/app/(dashboard)/retailers/[id]/actions.ts:238-272`
and its calling form in the same directory's `page.tsx` — no `useActionState`/error
rendering path exists.

**CONFIDENCE: HIGH**

---

## #7 — Worker role cannot access CUSTOMER step

**CLAIM:** `production_staff` role denied access at the CUSTOMER step of the
retail-worker journey.

**INDEPENDENT TEST:** Fresh browser session, logged in as the actual
`production_staff` demo persona (not the `alteration_worker` persona used in an
earlier, separate test), and attempted the exact same customer/garment access path.

**EVIDENCE:**

- Logged in at `http://localhost:3001/login` as "Production specialist."
- Reached a customer appointment, then the full customer profile at
  `/customers/56b7455a-b2bf-4dec-91b5-285b68e47479` (contact, wardrobe, orders,
  metrics all visible).
- Reached the linked alteration task at `/alterations/292e7d25-...` with full
  detail.
- No permission walls, no console access-denied errors.

**RESULT: FALSE ALARM**

**SHIP IMPACT:** None — directly contradicted by live reproduction. This is the
second independent live test this session finding `production_staff`/`alteration_worker`
personas have full, working customer access.

**CONFIDENCE: HIGH**

---

## #8 — Customer-visibility dashboard (conditional)

**CLAIM:** Missing from admin app; conditional P0/P1 "if required for MVP."

**INDEPENDENT TEST:** Checked `docs/PHASE.md` (the authorized work queue),
`docs/NON_GOALS.md`, `docs/CAPABILITY_DISPOSITION.md`, `docs/ROADMAP.md`,
`docs/VISION.md` — the actual scope authorities, not the audit's own opinion.

**EVIDENCE:** Not mentioned in any of the five authoritative scope documents.
The only place this appears is inside the 2026-08-21 audit's own output.

**RESULT: FALSE ALARM as a "P0/P1 blocker"** — recharacterized as **genuinely
undecided scope**, not a confirmed defect. No founder decision exists to check
this against.

**SHIP IMPACT:** Not a ship blocker unless/until the founder decides it's in
current scope. Converting an undecided roadmap question into a P0 is exactly the
"feature creep as release blocker" failure mode the original audit brief warned
against.

**CONFIDENCE: HIGH** (confidence in the scope-documentation search, not in any
opinion about whether it _should_ be in scope — that's a product call, not
evidence).

---

## #9 — Escalation / exception dashboard (conditional)

**CLAIM:** Missing platform-wide incident visibility; conditional P1.

**INDEPENDENT TEST:** Same as #8.

**EVIDENCE:** Not in NON_GOALS/CAPABILITY_DISPOSITION/ROADMAP/VISION. `docs/PHASE.md`
does note, in passing, that "escalation in particular has no existing schema at all
and would need a genuine design decision" — i.e. the founder's own queue
acknowledges this is an open design question, not a settled requirement.

**RESULT: Recharacterized as genuinely undecided scope, not a confirmed blocker.**

**SHIP IMPACT:** Same as #8 — a founder scope decision, not a defect.

**CONFIDENCE: HIGH**

---

## #10 — Third-party journey (conditional)

**CLAIM:** Dry cleaner / alteration-provider portal entirely missing; conditional
P0/PARKED depending on scope.

**INDEPENDENT TEST:** Same as #8/#9.

**EVIDENCE:** Not addressed in any authoritative scope document. Service partners
currently exist only as data entities managed by retailers, with no independent
auth/portal — consistent across all scope docs checked.

**RESULT: Recharacterized as genuinely undecided scope, not a confirmed blocker.**

**SHIP IMPACT:** Same as #8/#9. If third-party self-service is required for the
FW-season launch, this is real, substantial missing work — but that's a scope
question for the founder, not evidence of an overlooked defect.

**CONFIDENCE: HIGH**

---

## Bonus — Stop-hook failure (`scripts/fleet/stop-continue.sh`)

**INDEPENDENT TEST:** Confirmed `scripts/fleet/` was deliberately deleted in commit
`e5b3ad8` ("chore: remove fleet automation scripts"); `.claude/settings.json` Stop
and SessionStart hooks were never updated to match. Searched the entire repo
(excluding `.claude/`) for any product or CI dependency on this path.

**EVIDENCE:** Zero references outside `.claude/settings.json` and one mention in
`docs/GROUND_TRUTH.md` (a documentation artifact). No CI workflow, migration, test,
or application code references it.

**RESULT:** Confirmed pure local Claude Code tooling config drift.

**SHIP IMPACT:** None. Does not touch the deployed PAON application at all — this
is a session-automation hook, invisible to production.

**CONFIDENCE: HIGH**

---

# VERIFIED RELEASE GATE

**CONFIRMED SHIP BLOCKERS**

1. Production customer app returns HTTP 500 right now (`/r/maison-dubois`) —
   schema drift, revenue-blocking.
2. Zero error-tracking/observability infrastructure anywhere — production failures
   invisible without manual log review.
3. Demo-login is live and functional on all three production apps right now.
4. No rehearsed/safe path to bring production schema current (blocks fixing #1
   safely) — 249 migrations, no CI application step, no rollback plan.
5. Six of seven admin Server Actions silently fail with zero operator feedback
   (retailer suspend/activate, staff invite, prospect stage, demo publication,
   inquiry status; the seventh, demo-login toggle, throws unhandled instead).

**FALSE ALARMS**

- Worker role (`production_staff`) cannot access CUSTOMER step — directly
  contradicted by live reproduction; full customer access confirmed.
- Wardrobe-visualization cron job "partial failures not monitored" — has proper
  per-job try/catch and failure counting.
- "Suspended retailer's storefront stays accessible" — storefront gating checks
  status correctly and independently; only the admin-side feedback is missing.

**UNKNOWN / NEEDS ACCESS**

- Supabase credential exposed in chat 2026-08-01 — real, pre-existing claim in
  `ENVIRONMENTS.md`, but no independent evidence confirms or refutes it, or
  whether it was ever rotated. Needs a direct answer from whoever wrote that line,
  not more repo archaeology.

**NON-BLOCKING FINDINGS**

- Claude Code Stop-hook references a deleted script — local tooling drift only,
  zero product impact.
- `setDemoLoginsActive()` throws unhandled rather than failing silently — same
  underlying gap (no error boundary) as the other 5, different symptom.

**PARKED / FUTURE SCOPE (recharacterized, not blockers)**

- Customer-visibility dashboard in admin app — undecided, not in any scope doc.
- Escalation/exception dashboard — undecided; `PHASE.md` notes it needs a design
  decision that hasn't been made.
- Third-party (dry cleaner/alteration provider) portal journey — undecided, not
  in any scope doc.

---

## Tally

- Original items independently reviewed: 10 (7 numbered blockers + 3 conditional
  scope items), plus 1 bonus tooling item.
- Confirmed real blockers: 5
- False alarms: 3 (2 full claims + 1 sub-claim within a confirmed item)
- Unknown (unresolvable from repo evidence): 1
- Downgraded from "conditional P0/P1" to "undecided scope, not a blocker": 3
- Conditional scope items actually required for the current release: 0 confirmed
  (all 3 are genuinely undecided — a founder call, not evidence of incompleteness)

---

# FINAL VERDICT

# NOT SHIP READY

But on a materially narrower and now independently confirmed basis than the
original audit claimed. Ordered blockers:

1. Fix or roll back the production customer-app HTTP 500 (schema drift).
2. Stand up minimum error tracking/observability before anything else ships,
   so the rest of this list — and whatever comes after — is actually visible
   when it breaks.
3. Disable `NEXT_PUBLIC_DEMO_LOGIN` on all three production Vercel projects.
4. Get a rehearsed, approved migration path (with restore/rollback proof) before
   touching production schema again — this is what's blocking #1 from being
   fixed safely.
5. Add error-state feedback to the 6 silent admin Server Actions.

Separately, and not blocking: get a direct answer on the 2026-08-01 credential
claim and rotate as cheap insurance regardless of certainty; and get founder
scope decisions on the 3 undecided capabilities so they stop recurring as
false blockers in future audits.
