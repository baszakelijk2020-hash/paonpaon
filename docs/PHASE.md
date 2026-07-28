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

## Where things stand (2026-07-27)

**Done today.** Repository brought back under control: 21 stranded commits
and 130 uncommitted files pushed; CI switched on for the first time and made
green (stale Node pin, prettier parsing verbatim HTML, e2e gated to manual);
docs tiered so a session reads ~500 lines instead of 6,000; `AGENTS.md`
added so Codex loads the same charter as Claude; a stale handoff file that
told agents "do not stop" archived. Then the build audit (ADR-051) and the
verbatim-porting rule (ADR-052).

**Parked.** Fit tools — the `vox-` slider is ported correctly but the
feature needs an integration with each retailer's supplier ordering system.
See `DESIGN_PORTS.md`.

**Also done.** Design tokens now use `paon.html`'s real warm palette
(`#f4f1ec` / `#cdc9c2` / `#2a2925`) and OptimaKlein as the **body** face at
13px — an earlier version substituted a pure grey ramp and Inter, which is
the single largest reason the portals did not look like the founder's design.
Do not reintroduce that substitution.

**Blocked on founder design.** The alterations vertical. Everything under
`/alterations/*` was invented by an engineering session and carries none of
the founder's cues. The real product there is workshop work-order handling
and owner cost control, not fit correction. Do not build or extend it until
that design exists.

## Live right now

All three apps are deployed and confirmed responding (2026-07-28):

- <https://paonpaon-customer.vercel.app/r/maison-dubois> — founder's
  template, seeded production data.
- <https://paonpaon-admin.vercel.app/login>
- <https://paonpaon-retailer.vercel.app/login>

All connected to the hosted Supabase project, all deploy-on-push to `main`,
all have `NEXT_PUBLIC_DEMO_LOGIN=1` set for one-click persona login. Full
details, IDs and runbook: [DEPLOYMENT.md](./DEPLOYMENT.md), including a
footgun discovered while bringing these up (a stale root-level Vercel link
that redeployed the wrong project) and the stale duplicate `paon-*`
projects the founder has said to leave alone.

Queue item "a retailer logged into Mission Control alongside the
storefront" is done — the prerequisite for item 3 below is now just
populating the demo data, not deploying anything.

## The queue

Founder decision 2026-07-27: finish the build to a demonstrable state.
Ordered by what a prospect sees first. **One increment at a time, reviewed
and committed before the next** — the order is fixed, the batching is not
negotiable (see [WORKING_AGREEMENT.md](./WORKING_AGREEMENT.md)).

1. **Stripe live.** Blocked on the founder provisioning credentials — no
   session can do this. Once `STRIPE_SECRET_KEY` is set, verify a real
   Connect onboarding and a real charge end to end. ADR-030 code is
   complete and has never executed.
2. **Resend live.** Same shape. `RESEND_API_KEY` set, then verify the outbox
   actually delivers.
3. **A demo retailer that looks like a real store.** Full catalog with real
   photography, a populated client book, plausible order/loyalty/appointment
   history. This is what every prospect conversation runs on.
4. **Walk the whole flow on a phone and fix what breaks.** Storefront →
   account → appointment → order → loyalty. Fix only real breakage; resist
   redesigning on the way through.
5. **Whole-product visual and motion pass — UNBLOCKED, founder decision
   2026-07-27.**
   **`paon.html` is the design language for the entire product**, staff app
   included. Not pag1's Mission Control. One language across customer and
   retailer.

   Its actual vocabulary, sampled from
   `apps/customer/app/r/[slug]/paon-template.html` — use these values, do
   not invent adjacent ones:
   - **Surfaces**: `--cream #f4f1ec`, `--warm-mid #e8e4de`, `--mid #cdc9c2`,
     `--panel #0e0e0c`. Already in `packages/ui/src/styles/globals.css` as
     the stone scale.
   - **Ink**: body `--text #2a2925`, headline `--black #111110`, secondary
     `--muted #7a7870`.
   - **Type**: OptimaKlein at 13px base for body and headline. `GTBold3` at
     7px, uppercase, `#666666` for eyebrow/section labels
     (`.cat-section-heading`). No Inter anywhere.
   - **Chrome**: dark rail sidebar,
     `linear-gradient(to right, #333, #1a1a1a)`, 250px wide, 60px header
     row, logo in `Aviano` at 19px (`aside`, `#sidebar-logo`).
   - **Nav items**: `.cat-label` — OptimaKlein 13px, `#a6a6a6`, brightening
     to `#d9d9d9` on hover.
   - **Motion**: `cubic-bezier(.22,.61,.36,1)`, ~220ms.

   **Motion is part of the design, not decoration.** Sampled from the same
   file — use these, do not invent:
   - Easing: `cubic-bezier(.22,.61,.36,1)` (41 occurrences; the house
     curve). GSAP tweens use `expo.out`.
   - Durations: 0.2s for state flips, 0.62–0.72s for panel and view
     transitions, 1.0s for content reveals.
   - Content reveal, verbatim:
     `from { opacity: 0, y: 20, scale: 0.97, filter: 'blur(4px)' }` →
     `to { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }`, staggered
     ~120ms per card, `expo.out`.
   - Images fade from `opacity: 0; transform: scale(1.04)` to `1` on load.
   - Below-fold content is revealed by ScrollTrigger against the scrolling
     container, `start: 'top 95%'`, `once: true`.

   **Scope: every environment and every window**, not just the Retailer
   Portal — customer portal, retailer portal, admin, marketing site, and
   the full checkout sequence (cart → address → payment → confirmation),
   which currently has no design treatment at all. One language across all
   of it.

   Work one page or one flow step per increment. Do not restructure layout
   or change behaviour — this is a visual and motion pass, not a rebuild.
   The founder's own template is the reference for every question; when
   unsure how something should look or move, read
   `apps/customer/app/r/[slug]/paon-template.html` rather than deciding.

6. **Re-port the wrong widgets** — silhouette carousel, swipe deck — per
   [DESIGN_PORTS.md](./DESIGN_PORTS.md), and verify the two unverified ones
   (table service, house party orbit).

Not in the queue and not to be started: fit tools (parked), the alterations
vertical (awaiting founder design), and the four presentation modules —
globe, lapel configurator, gift-card booklet, pag2 vouchers.

## Two questions to answer before building

Both come from the build audit in `DECISIONS.md` ADR-051. Neither is
rhetorical; work is gated on them.

**1. Is `paon-template.html` a demo artifact or the product? — ANSWERED
2026-07-27: it is the product.** It is the retailer's digital front door,
the thing PAON sells on subscription, and the artifact that started this
venture. It is therefore maintained as canonical design source, ported
verbatim, and never re-expressed in `@paon/ui` — see
[DESIGN_PORTS.md](./DESIGN_PORTS.md) and ADR-052. The same applies to every
surface designed in `downloaded_pages/pag1–3.html`.

**1b. Which design language does the staff app use? — ANSWERED 2026-07-27:
`paon.html`, for the entire product.** pag1's Mission Control is not the
target. See queue item 5 for the sampled vocabulary.

**2. Which wedge is actually being sold?** A prettier storefront is
aesthetic. Control over third-party alteration cost — the alterations
vertical, already the deepest thing built — is financial. Neither has been
tested with a real retailer. Two phone calls asking which they would pay
for costs nothing and could redirect the whole build.

## Foundation work, in scope by exception

These are not one of the three workstreams but are authorised by ADR-051
because they serve this phase directly:

- **Provision Stripe.** The objective is retailers with money down. PAON
  cannot currently accept money — the payment code (ADR-030) exists but has
  never run, because credentials were never provisioned.
- **Connect Vercel to git.** Deploys are currently manual CLI archive
  uploads with no git integration, so there is no per-change preview URL.
  The conversion instrument is sending a prospect a link; this is the
  infrastructure that makes that routine.

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
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

All six green — this is exactly what CI runs. Stop `pnpm dev` first;
rebuilding `.next` under a live dev server has corrupted it before.

Then report a **Test it** section per `CLAUDE.md`: exact local URL, port,
prerequisites, auth path, and what was already verified automatically.
