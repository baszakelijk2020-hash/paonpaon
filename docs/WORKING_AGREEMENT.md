# Working Agreement

This document expands the continuous-build contract in `AGENTS.md`. It applies
equally to Codex, Cursor, Claude Code, and human engineering sessions.

## The loop

Repeat this loop without an intermediate human gate:

1. **Inspect.** Take the first unfinished item in `PHASE.md`. Read its
   dependency ADR and the relevant implementation. Confirm what exists from
   code and migrations.
2. **Implement one coherent slice.** Keep the change reviewable and aligned to
   the queue item's acceptance criteria. Do not mix unrelated cleanup into it.
3. **Test.** Run the smallest useful tests during development, then the full
   definition of done before the slice is complete.
4. **Repair.** A failing test or visual check starts another repair cycle; it
   is not a reason to hand the work back.
5. **Update authoritative state.** Mark only verified acceptance criteria
   complete in `PHASE.md` and update the compact Resume Protocol in
   `PAON_INTELLIGENCE_PLATFORM.md`. Add an ADR only for a decision, not as a
   progress log. Keep `PROJECT_STATE.md` factual and short.
6. **Commit and push.** Commit the coherent slice with a plain-language reason,
   push it to `origin/main`, and repair CI immediately if it fails.
7. **Advance immediately.** Take the next buildable queue item in the same
   session. Never wait for routine review or confirmation.

## What “finished” means

A session is finished only when all of these are true:

- the active founder request is complete;
- the ordered buildable queue is empty;
- only explicit hard blockers remain;
- verification is green;
- authoritative state matches reality; and
- finished work is committed and pushed.

Shipping one slice, publishing an audit, or writing a handoff is not a stopping
condition while buildable work remains.

## Hard blockers

Only the blockers listed in `PHASE.md` may stop the programme. Missing optional
provider credentials, a blocked later stage, visual preference uncertainty, or
the desire for review are not global blockers: record the limitation and take
the next independent queue item.

Do not bypass a blocker by inventing a founder-designed surface, weakening RLS,
silently reversing an ADR, or performing an irreversible production-data
operation.

## Verification

During implementation, prefer focused unit, repository, migration, browser, and
accessibility tests. Before declaring a slice complete, run:

```text
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

Stop `pnpm dev` before building so `.next` is not rebuilt under a live server.
Schema slices also require generated database types and tenant-isolation tests.
Founder HTML mounts require desktop and mobile browser verification without
rewriting the canonical markup.

## Repository discipline

- Preserve unrelated user changes in a dirty worktree.
- Use forward migrations; never edit a merged migration.
- Name temporary files `_tmp-*` and remove them before committing.
- Do not store secrets in documentation, commits, or command output.
- `PROJECT_STATE.md` records facts only. The queue belongs only in `PHASE.md`.
- `docs/README.md` is the authority map; do not create a competing plan.
