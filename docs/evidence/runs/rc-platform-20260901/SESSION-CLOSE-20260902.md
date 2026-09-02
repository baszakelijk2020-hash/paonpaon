# RC Platform 20260901 — session-close addendum (2026-09-02)

Supplements `REMAINING.md`. rc HEAD `674959a` on `rc/platform-20260901`.
Nothing pushed; nothing merged to `release-integration-lane-h` or `main`.

## Delivered and verified this pipeline

1. **Global sign-out** across customer/retailer/admin — GLOBAL scope
   (`supabase.auth.signOut()`, no `scope` arg), "on this device" copy removed,
   the retailer/admin AppShell dual-mount "zero-POST" bug fixed with two
   independent `SignOutButton` client components. Cross-context refresh-token
   revocation proven (200 → 400) for all three apps. Security review: **ACCEPT**
   (`9a777cc` / `docs/evidence/reviews/global-signout-security-review/`).

2. **V3 controller candidate `e17236b`** — security review: **ACCEPT**
   (`review/v3-controller-security-20260901` @ `8b204d9`).

3. **Release candidate `rc/platform-20260901`** — both candidates merged
   (`2cb28da`, `932a8ac`), **0 conflicts**. `supabase db reset` clean through
   `20260828185506`; pgTAP **51 files / 559 tests / 0 fail**; the two
   RLS-critical files (`roadmap_approval_rls_test.sql`,
   `roadmap_gap_disposition_rls_test.sql`) re-run independently 44/44.
   customer/retailer/admin lint + typecheck + production build all green
   (6/6, 3/3). Focused E2E green. `database.types.ts` regen was pure
   CLI-v2.115 whitespace churn → kept the schema-accurate hand-authored
   entry. Independent integration review: **ACCEPT** at rc level (`4baf537`).

4. **Completion validator un-blocked** (`256622c`) — it was aborting with an
   uncaught throw at a malformed legacy tranche; six Stage-20/21 tranches
   converted to the structured schema so it now enumerates the full backlog.

5. **20.17** (advisor-selection removal) — **fully closed**: spec 2/2 green at
   rc HEAD, path-verified `runs/20.17.json` + `tranches/20.17.json`, PHASE.md
   `[x]`; not in the validator failure list (`6c531f9`, `ebb1220`).

6. **20.21** (raw-PDP → DFR handoff) — tranche + run **validate clean**
   (`6c531f9`, `ebb1220`); PHASE.md checkbox intentionally held `[ ]` because
   its dependency **20.7** is not yet checked.

7. **R0.4** spec fixed and **3/3 green** (`674959a`, test-only): three
   assertions in `apps/retailer/e2e/house-memory-advisor-today.spec.ts` (from
   V3-controller commit `c74bea2`) never matched the shipped UI —
   `/customer declared/i` vs the rendered `Declared · <factType>` label; an
   evidence-note assertion for text the Self-Portrait read view does not
   render; and `retailer_staff_members` rows created without `accepted_at` so
   the second advisor's login hit the "set your password" screen. All three
   corrected. Still owed: `runs/R0.4.json` + `tranches/R0.4.json` + PHASE.md
   `[x]` (the proof exists; only the evidence-file authoring remains).

## Reset (integrity)

A delegated Backlog-C/D evidence sweep (`f60628b`/`da78dd9`/`a8856df`)
authored ~20 tranches with **fabricated artifact paths** (e.g. a `.ts`
migration for a file that is `.sql`; `wardrobe-actions.ts` for
`roadmap-actions.ts`) and flipped 4 PHASE.md checkboxes on evidence that does
not validate (ADR-068 violation). It was `git reset --hard` back to the
ledger commit — **nothing had been pushed**. Lesson: path-accurate tranche
authoring must not be delegated; every cited path must be greped first.

## Remaining (all pre-existing; none introduced by this integration)

Per `REMAINING.md` groups R1–R5: **~41 `validate:completion` items** — 21
Stage-20/21 checked items with no tranche (R1), stale run SHAs on
17.x/18.5/8.4/9.1/20.1–20.4/21.2/21.6 (R2/R3), obsolete VWS path citations on
4.6–4.10 (R4), and **20.15** (R5) — a deterministic console **400 Bad
Request** during the customer warm-navigation sweep whose failing request URL
was not captured; needs `playwright show-trace` network analysis to identify
the endpoint before it can be judged pre-existing vs integration-caused.

`rc/platform-20260901` is a verified, independently-reviewed integration of
the two accepted candidates. It is **not** merge-to-`main` ready until R1–R5
are green or each residual is an explicit documented blocker. `20.15` is the
one residual that could be a real regression and should be diagnosed first.
