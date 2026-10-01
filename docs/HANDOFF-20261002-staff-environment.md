# Handoff — 2 Oct 2026: security, invites, restyle, alterations, next gaps

Branch `platform-integrated-20260903` (pushed). Local Supabase has every
migration up to `20261002100000` applied and recorded. Read this, then
`docs/audits/2026-10-01-fixes-for-forks.md` (the full fix list, also for the
Adam Store fork).

## Done (committed)

- Database permission hole closed: Supabase default grants left 210
  customer functions open to logged-out users and 63 server-only jobs
  (email queue, Stripe recorder…) open to any signed-in user
  (`20261001110000`). Guard test `security_definer_hygiene_test.sql`.
- Security-review hardening (`20261001100000`, `20261001130000`):
  - closure notes are staff-only;
  - reschedules are bounded;
  - party chat rows carry `retailer_id`;
  - party RSVPs can only be changed by the member or the organizer;
  - photo bytes are checked;
  - address search is rate-limited.
- Tailoring Party invites sent by PAON (`20261001120000`):
  - no customer or member is created until the guest joins;
  - limits apply per organizer, per address and per retailer;
  - opt-outs are honoured.
  - **They need the Resend key to actually go out.**
- Morning Routine clock and commute: New York time until location is
  allowed; 19m for guests; "Set work address" / "Allow location" otherwise.
- Zero Canvas +99, Zero Canvas Handmade +199.
- Admin and retailer restyled to the atelier-demo look (`packages/ui`
  AppShell, AuthShell, `styles/globals.css`, fonts in each app). The
  restyle commit `273d2bf` was not pushed until this handoff.

## Done in commit 89b0a08

FT-04 alterations, `20261002100000_ft04_dispatch_follow_up.sql`:

- Fixed: dispatch never worked (ON CONFLICT predicate mismatch).
- Fixed: after a reload the grid ignored the saved version and showed zeros
  (`apps/retailer/components/alterations/ft04-alteration-grid.tsx`, now uses
  `current`).
- Dispatch dialog now takes an order number, comments and photos.
- Dispatch creates the Mission Control follow-up "Update the fit profile
  from the locked grid" (`clienteling_opportunities.source_alteration_id`,
  type `fit_profile_update`), and the link opens `/alterations/<id>#ft04-grid`.
- New `/alterations/workbench` page (to do / in progress / ready for
  review) for workers, workshop managers and oversight roles.
- pgTAP `ft04_dispatch_follow_up_test.sql` passes.
- **Not browser-verified**: the machine was out of memory and the test
  browser timed out. Re-run `scratchpad`-style flow:
  intake → grid → save → "Create selective work order" → order number +
  photo → Dispatch → Mission Control link → Workbench.

If that commit did NOT land (`git status` shows the workbench folder as
untracked), run `git add -A supabase packages apps/retailer && git commit`
— the pre-commit hook runs lint and typecheck; on a busy machine it takes
over 10 minutes.

## Next: staff-environment gaps (founder asked 2 Oct), priority order

From a code audit, not yet built:

1. **Security — customer rows readable by every staff role.** The
   `customers` RLS (`20260719000007`) is retailer-wide; masking is app-side
   only. Workers/workshop roles can open `/customers/[id]` by URL. Add a
   role guard on those routes, and tighten RLS so worker roles cannot read
   customer PII.
2. **Access audit for managers.** `record_customer_access_event` is logged
   only for non-assigned opens (`customers/[id]/page.tsx` ~425,
   best-effort). Log every profile open, and add an owner/manager screen
   over `audit_log_entries`: who opened which profile, and when.
3. **Rate limit and anomaly flags.** Neither exists. Flag many profile
   opens in a short window, or off-hours access, as a manager notification.
   Optionally throttle.
4. **New-appointment and new-order notifications to staff.**
   `request_appointment` and `checkout_cart` notify nobody, while
   cancel/reschedule already do. Copy their notification insert.
5. **Priority / after-hours booking.** "Request priority booking" fails on
   exactly the taken slot it targets (`appointment_slot_conflict` raises).
   It needs a real flag (column), a path that bypasses the capacity check
   for priority requests, and an urgent badge in staff appointments and
   Mission Control. Customer side: `appointments/quick-book-bar.tsx:111-130`.
6. **Tailoring Party for staff.** Staff cannot read the party chat
   (`wedding_party_messages`, no staff policy) or see attendance
   (`wedding-parties/[id]/page.tsx`).
7. **Customer activity for staff.**
   - No per-customer login or last-seen.
   - The live storefront (`paon-template.html`) tracks no category or
     product views; only the legacy product page calls `track-view`.
   - Wire `trackStorefrontEvent` from the template (consent-gated), and
     show product and category names in `self-portrait.tsx` recent
     activity.

Already fine: staff search, wishlist and profile sections, ask-advisor and
TableService messages (with notifications), and customer cancel/reschedule
notifications.

## Other open items

- Founder: Resend key, rotate the leaked Supabase key, pick an alert
  service.
- Full customer-journey E2E test (R0.5) not built.
- Retailer e2e `retailer-signout-v3` desktop failed once under load. A
  manual test signs out correctly.

## Machine / environment notes

- 16 GB RAM. The Adam Store session runs 7+ `next dev` servers (ports
  3011–3018, 3027) at 2–5 GB each, plus Docker at about 7 GB. Local Postgres
  crashed once from memory pressure; it recovered with data intact.
- Never touch `:3002` (founder's server, PAON customer prod build) or the
  ADAM-STORE ports.
- A "read-only" test agent once ran `prettier --write` + `git checkout` on a
  dirty file. Before agents, snapshot with
  `git update-ref refs/backup/<name> $(git stash create)`.
- Applying migrations locally: `psql -1 -f` per file, then insert the
  version into `supabase_migrations.schema_migrations`.
  (`supabase migration up` is unusable because of history drift.)
- Regenerate types with `supabase gen types typescript --local`, then
  re-apply the two nullable args `p_date_of_birth` and
  `p_profile_photo_url`.

- `docs/evidence/runs/global-signout-v3/retailer/*.png` were overwritten by a
  test run (new look). Left uncommitted on purpose: commit them as fresh
  evidence once the sign-out tests are re-run.
