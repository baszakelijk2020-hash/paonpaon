# Founder Answers

Answers to the blocking questions in `FOUNDER_QUESTIONS.md`. Recorded
verbatim as received from the founder on 2026-08-06, gating
`MIGRATION_PLAN.md` Steps 8 and 9.

---

## Q4 — `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`

**Decision: Option 2.**

Keep `docs/vision/CURSOR_UNIFIED_RETAIL_OS_CONTINUOUS_PROMPT.md`, but
convert it into a thin, explicitly subordinate tool-specific wrapper.

Repository authority must exist only once. `AGENTS.md` remains the
canonical operational instruction set.

The Cursor prompt must only contain Cursor-specific execution behaviour and
startup instructions, then immediately delegate to `AGENTS.md` and the
canonical documentation hierarchy.

It must never become an independently maintained operating specification.

---

## Q5 — `/Users/nguyen/Downloads/paon.html`

**Decision: Option 2.**

Treat `/Users/nguyen/Downloads/paon.html` as a local working copy unless it
is later proven to contain unique repository-relevant information.

Do not introduce it as another documentation authority.

Correct `docs/EXPERIENCE_REBUILD.md` so it references the committed
repository artifacts instead of an absolute local filesystem path.

If unique content is later discovered, import it deliberately into the
repository under version control and update the documentation accordingly.
