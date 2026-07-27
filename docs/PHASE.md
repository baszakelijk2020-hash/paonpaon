# Current Phase

**Read this first, every session. It overrides any older plan.**

Last set: 2026-07-27. If today is far past that date, ask before assuming
this is still current.

## The objective

Three paid pilot commitments from independent menswear retailers who sell
**only their own made-to-measure** — one label, no third-party stock. Money
down, not letters of intent, not enthusiasm.

Multi-brand retailers are the larger market and come second. Targeting
single-label MTM first is a deliberate choice to remove the biggest
prerequisite from the critical path: PAON has no `Brand` entity, and a
single-label retailer does not need one. Multi-brand is a roadmap item shown
to prospects, not infrastructure built before the first sale. See
`COMPETITIVE_GAPS.md`, "Multi-brand, deferred."

Everything else is subordinate to that. PAON already has more capability
than it has evidence anyone will pay for. The constraint is not engineering
capacity — it is proof.

## In scope — only these three

| #   | Workstream                                                       | Why it exists                                                  |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Storefront template — `apps/customer/app/r/[slug]`               | What a prospect actually judges                                |
| 2   | Demo Studio — `apps/admin/app/(dashboard)/prospects/[id]/studio` | The conversion instrument: their store, their name, in an hour |
| 3   | Marketing site — `apps/customer/app/(marketing)`                 | Survives the Google search after a cold email                  |

## Out of scope

Everything else — including work that fits the architecture perfectly,
closes a documented gap, or completes a roadmap phase.

`ROADMAP.md` and `COMPETITIVE_GAPS.md` are **not work queues during this
phase.** They are reference. Reading them is not permission to build from
them.

If asked to build outside the three workstreams: say it falls outside the
freeze, and ask. Do not build it quietly because it seemed reasonable.

## The test for any change

> Does this make a retailer more likely to put money down?

If not, it waits. This narrows what gets built. It does not lower the
quality bar for what does — the rules in `CLAUDE.md` and `PRINCIPLES.md`
apply in full.

## Stop and ask

Previous sessions ran unsupervised for long stretches and the build drifted.
That is the failure this phase is correcting. Stop and ask when:

- The work would touch anything outside the three workstreams.
- A change needs a new domain entity, migration, or shared package.
- You are about to contradict an ADR in `DECISIONS.md`.
- You have been working for a long stretch without the founder seeing output.

Autonomy is not the goal. Reviewable increments are.

## End every session committable

No throwaway spec files, no temporary routes, no scratch artifacts. Name
temporary files `_tmp-*` so `.gitignore` catches them. Commit what was worth
writing; delete what was scaffolding.

Uncommitted work is unreviewable and unrevertable. At the point this phase
began there were 21 unpushed commits and 130 uncommitted files. That is what
losing control looks like in practice.

## Definition of done, this phase

```
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

All four green. Stop `pnpm dev` before `pnpm build` — rebuilding `.next`
under a live dev server has corrupted it before.

Then report a **Test it** section per `CLAUDE.md`: exact local URL, port,
prerequisites, auth path, and what was already verified automatically.
