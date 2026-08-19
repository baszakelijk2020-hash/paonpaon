You are working inside the existing PAON repository.

Your objective is NOT to build new product functionality.

Your objective is to configure this repository into a production-grade Claude Code engineering environment while preserving the existing PAON architecture, conventions and design.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GLOBAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FIRST inspect the entire repository.

Do not assume anything.

Reuse existing architecture, naming conventions, scripts, package structure, tooling, coding style and workflows.

Never replace existing functionality if it already satisfies the objective.

Merge configuration instead of overwriting.

Never modify business logic unless absolutely required for this configuration work.

Never redesign the ecommerce frontend.

Never introduce a new visual identity.

Never refactor unrelated code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — REPOSITORY AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Inspect and understand:

- repository structure
- monorepo configuration
- package.json files
- workspace configuration
- CLAUDE.md
- PHASE.md
- PROJECT_STATE.md
- DESIGN_SYSTEM.md
- UX_PHILOSOPHY.md
- founder documentation
- existing CI
- Playwright
- Supabase
- database
- tests
- scripts
- hooks
- existing Claude configuration

Only after the audit continue.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CLAUDE CODE CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify the following plugins are installed and enabled:

- supabase
- typescript-lsp
- context7
- security-guidance
- frontend-design

Ensure:

superpowers

remains disabled.

Verify

.claude/settings.json

is valid JSON.

Do not overwrite existing settings.

Merge intelligently.

Configure:

PostToolUse

After every:

Edit
Write
MultiEdit

run

pnpm exec prettier --write "$CLAUDE_FILE_PATH"

only for the modified file.

Configure:

Stop Hook

Run

./scripts/claude-stop-check.sh

automatically before Claude finishes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — STOP CHECK SCRIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify

scripts/claude-stop-check.sh

exists.

If not, create it.

It must:

run

pnpm lint

then

pnpm typecheck

If either fails:

fail immediately.

Do NOT silently continue.

Do NOT add Playwright.

Do NOT add pgTAP.

Do NOT add long-running tests.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — PROJECT SUBAGENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create

.claude/agents

if necessary.

────────────────────────────

repository-explorer.md

Model:

Haiku

Purpose:

Read-only repository exploration.

Responsibilities:

- locate implementations
- locate routes
- locate repositories
- locate migrations
- locate tests
- locate documentation
- inspect git history
- inspect semantic alternatives
- inspect architecture

Never modify files.

Never conclude something does not exist until exhaustive repository search has been completed.

────────────────────────────

security-reviewer.md

Model:

Sonnet

Responsibilities:

Review only.

Inspect:

- RLS
- tenancy
- auth
- Supabase
- SECURITY DEFINER
- grants
- storage
- payments
- idempotency
- cross-house leakage
- module boundaries

Do not modify implementation unless explicitly delegated.

────────────────────────────

paon-frontend-reviewer.md

Model:

Sonnet

Responsibilities:

Review and enrich NEW PAON interfaces.

Authority:

- paon.html
- DESIGN_SYSTEM.md
- UX_PHILOSOPHY.md
- founder HTML
- existing ecommerce
- @paon/ui

Rules:

Never redesign ecommerce.

Never invent colors.

Never invent typography.

Never invent visual identity.

Never introduce generic SaaS styling.

Never introduce glassmorphism.

Never introduce arbitrary gradients.

Never introduce unnecessary animation.

Only enrich NEW operational modules while remaining visually indistinguishable from PAON.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — UPDATE CLAUDE.MD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update CLAUDE.md.

Document:

Main implementation model:

Sonnet

Repository explorer:

Haiku

Security reviewer:

Sonnet

Frontend reviewer:

Sonnet

Workflow:

- one active PHASE
- preserve architecture
- preserve design authority
- boundary-first implementation
- specialist agents where beneficial
- verify before completion
- never claim completion without successful validation

Do not remove existing project guidance.

Merge intelligently.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — GITHUB ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Inspect the existing repository.

Create or improve

.github/workflows/quality.yml

ONLY using scripts that already exist.

Never invent commands.

Verify package.json first.

Configure independent jobs where applicable:

- lint
- typecheck
- unit/domain
- Playwright
- pgTAP

Reuse existing CI whenever possible.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — VISUAL REGRESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Inspect existing Playwright configuration.

If visual regression already exists:

improve it.

Otherwise:

implement visual regression ONLY for:

- ecommerce authority
- founder widgets
- shared UI
- core customer screens

Do NOT create snapshots for every page.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — DESIGN TOKENS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Inspect whether PAON already has centralized design tokens for:

- colors
- typography
- spacing
- radius
- elevation
- shadows
- motion

If already centralized:

leave unchanged.

If fragmented:

produce a migration plan.

Do NOT automatically migrate.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 9 — VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before finishing:

Execute validation.

Verify:

✓ settings.json is valid

✓ hooks execute correctly

✓ stop hook executes correctly

✓ prettier hook executes correctly

✓ subagents are recognised

✓ CLAUDE.md updated

✓ CI configuration valid

✓ no business logic changed

✓ no ecommerce redesign

✓ no architectural regression

Fix every issue you introduced.

Repeat validation until clean.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Produce a final engineering report containing:

1. Repository audit summary

2. Files created

3. Files modified

4. Hooks configured

5. Subagents installed

6. CI changes

7. Validation results

8. Remaining recommendations

Do not stop after writing files.

Do not assume success.

Verify every configuration by executing the appropriate commands and fixing any issues before declaring the task complete.
