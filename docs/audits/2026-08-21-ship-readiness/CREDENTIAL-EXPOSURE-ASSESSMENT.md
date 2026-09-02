# Credential Exposure Assessment — Security Unknown

## The claim

`docs/ENVIRONMENTS.md:71-75`:

> "Unresolved credential exposure (found 2026-08-01): a Supabase secret
> key was pasted into a chat transcript. No later record confirms
> rotation. Treat as still needing rotation until explicitly confirmed
> done; rotating it requires updating the corresponding Vercel
> environment variable in the same change or the affected production
> deployment breaks."

## Investigation performed (this session)

- Searched git history for any commit ever adding a `.env*` file or a
  hardcoded credential-shaped string. `.gitignore` has excluded `.env`,
  `.env.local`, `.env.*.local` since at least commit `65dbc93`
  (2026-07-28); only `.env.example` templates (with empty placeholders)
  are tracked. **No production Supabase secret was ever found in git
  history.**
- Inspected current local `.env.local` files: they contain local-only
  tokens (a Supabase CLI access token, a Vercel deployment token, and
  local Docker Supabase demo JWTs) — not a production service-role key.
- Found one unrelated, separate finding: commit `f92d692` (2026-08-09)
  flagged a live OpenRouter API key embedded in an untracked
  `.codex/config.toml` file. This is a different credential, already
  handled by that commit, and not the Supabase key described in
  ENVIRONMENTS.md.
- No incident-response document beyond ENVIRONMENTS.md's own note and
  `docs/audits/2026-08-21-ship-readiness/CRITICAL_BLOCKERS.md`'s
  restatement of the same claim was found.

## Determination: UNKNOWN — NOT VERIFIED

The exposure vector described (paste into a chat transcript) is, by
construction, not something that leaves evidence in this repository's
git history or file tree — a chat paste happens outside version control
entirely. This investigation can conclusively rule out a **git-history**
exposure (there is none), but it **cannot confirm or deny** the
chat-transcript exposure the note describes, because that event, if real,
would leave no trace here to check.

This is not "no exposure occurred" — it is "this investigation has no way
to verify whether it did." Do not read the absence of git evidence as
clearing this. The honest state remains what ENVIRONMENTS.md already
says: unresolved, unconfirmed either way, and the note's own instruction
— "treat as still needing rotation until explicitly confirmed done" —
is the correct operating stance regardless of this assessment's inability
to independently confirm the underlying event.

## What this session did NOT do

- Did not rotate the production Supabase service-role key or any other
  production credential. Rotation requires coordinated updates to the
  Vercel environment variables on all three `paonpaon-*` production
  projects in the same change (per ENVIRONMENTS.md's own warning that a
  mismatched rotation breaks the deployment) — this is a production
  credential change with real breakage risk if done incompletely, and
  was not something this session was authorized to do blind. It should
  be a deliberate, founder-directed action, ideally bundled with the
  Blocker 1 migration work window so both changes land together rather
  than as two separate risky production touches.
- Did not print, log, or otherwise expose any credential value while
  investigating — all checks above were structured to report presence/
  absence and placeholder-vs-real judgment only, never the literal
  string.

## Recommendation

Treat this as an open security item requiring founder decision, not a
release blocker in the sense of "code must change before ship" — there
is no code fix for an out-of-band chat exposure. The actionable item is:
**rotate the production Supabase service-role key as a precaution**,
coordinated with a Vercel environment variable update across all three
production projects, at a time the founder chooses. This assessment
does not upgrade the claim to CONFIRMED, nor does it downgrade it to
cleared — it remains exactly what ENVIRONMENTS.md already said:
unresolved.
