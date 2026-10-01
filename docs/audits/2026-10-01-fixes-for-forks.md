# Fixes to carry into forks (Adam Store) — 1 Oct 2026

PAON branch `platform-integrated-20260903`. Each item: what was wrong, the
fix, and where. Apply the same fix in any fork made from PAON before
1 Oct 2026 (Adam Store fork tag: `paon-checkpoint-pre-adam-20260930`).

## Critical: database permissions

1. **Functions callable by everyone.** Supabase's default privileges grant
   EXECUTE on every new `public` function directly to `anon` and
   `authenticated`. Our migrations only did `revoke ... from public`, which
   does NOT remove those grants.
   - Effect: logged-out visitors could call 210 customer-only functions.
     Any signed-in user could call 63 server-only jobs, including
     `claim_pending_emails` (everyone's queued emails), `claim_pending_sms`,
     `record_stripe_payment_event`, `recognize_customer_login_email` (shows
     which emails have accounts), the scan/visualisation job completers and
     `anonymize_*`.
   - Fix: `supabase/migrations/20261001110000_revoke_default_function_grants.sql`.
     It revokes from `anon` / `authenticated` every function whose migration
     revoked PUBLIC and never granted that role. Functions used inside RLS
     policies, views or defaults are left alone (policies run as the caller).
   - For a fork, regenerate the list against the fork's own database. Don't
     copy it blindly: the method is in the migration header.
   - **Rule for new migrations:** always write
     `revoke all on function f(...) from public, anon, authenticated;` and
     then grant only the roles that need it. The same applies to tables.
2. **RPC-only tables accepted direct INSERT** (same default-privilege cause):
   `store_feedback_signals`, `product_fabric_profiles`,
   `product_fabric_composition`, `metadata_assignment_reviews`,
   `gift_invitation_state_history`, and `message_attachments` for anon.
   Fixed in the same migration.
3. **Guard test:** `supabase/tests/security_definer_hygiene_test.sql`. It
   checks that every SECURITY DEFINER function pins `search_path`, that a
   path naming `public` puts `pg_temp` last, that nothing elevated is
   PUBLIC-executable, and that the worst server jobs are closed to
   signed-in users.

## Security review fixes

Migration `20261001100000_security_review_hardening.sql`:

- `appointment_closures`: the "anyone can read" policy and the anon grant
  exposed staff's free-text closure reasons. The table is now staff-only;
  guests check availability through the SECURITY DEFINER
  `appointment_slot_conflict()`.
- A closure's `branch_id` must belong to the same retailer (trigger).
- `reschedule_my_appointment`: there was no limit, so a customer could
  hold a branch's capacity for months. It now requires a future start and
  at most 8 hours.
- `wedding_party_messages` had no `retailer_id`. Added, backfilled and set
  from the party by a trigger.
- `customers.profile_photo_url` must be `https://`.
- 22 SECURITY DEFINER functions had `search_path = public`. Changed to
  `public, pg_temp`.

App code:

- Retailer `orders/[id]/actions.ts` `requestReturn`: it could mark any
  order refunded, even an unpaid or canceled one. It now uses
  `canTransitionOrder(status, "refunded")`.
- Customer `prepareTailoringPartyInvite` and `findUnavailableSlots`:
  reject non-UUID ids.
- `/api/address-search`: query capped at 200 characters.
- `inviteFriend` (loyalty): capped at 10 emails per request.
- `fitting-tray-actions.ts`: `requireSession()` was inside `try`, so the
  login redirect turned into an error message. Moved outside.

## Functional bugs

- Profile save cleared the profile photo: the identity form posts no photo
  field and the action sent `null`. It now keeps the stored photo when the
  field is absent (`account/actions.ts`).
- Database types were stale against the migrations, which caused 21
  typecheck errors. Regenerate with `supabase gen types typescript --local`,
  then re-apply the two nullable args (`p_date_of_birth`,
  `p_profile_photo_url`), which the generator emits as non-null.
- The loyalty tier rename (metre/milli/micron) needed the
  `20260924000001` migration applied to the local database.
- The schema guard test `stage-16-schema-security.test.ts` must allow
  `wedding_party_messages` (it is the party chat, not a second party model).
- Lint: duplicate React import and an orphan `<label>` in `identity-form.tsx`;
  combobox and option ARIA in `address-search-fields.tsx`; an unescaped
  apostrophe in `tailoring-party-planner.tsx`.

## New: real party invitations

`20261001120000_wedding_party_email_invitations.sql`:
`invite_wedding_party_guest()` is service-role only. It re-checks the
organizer, queues the email in `email_outbox` and records it in
`wedding_party_invitations`.

- It creates no customer and no member. The guest joins only through the
  link (`join_wedding_party`), so an organizer cannot enrol a real customer
  or fill the CRM.
- Limits apply across parties, because parties are cheap to create:
  - 40 invitations a day per organizer;
  - 1 an hour and 3 a day per address;
  - 500 a day per retailer;
  - 5 new parties a day per organizer (trigger).
- An address whose customer opted out of email, or has bounced, is never
  mailed.

The Server Action `sendTailoringPartyInvites`:

- proves the organizer with the user session first;
- allow-lists the occasion and caps the location length;
- escapes all HTML;
- returns only known limit messages to the browser;
- then calls the RPC with the service-role client.

The planner's Send button uses it in place of `mailto:`.
Test: `supabase/tests/wedding_party_email_invitations_test.sql`.

The first version auto-created members and customers, and its limits were
per party only, so creating new parties got round them. An independent
review caught both before commit. Lesson: put spam limits on the
organizer, address and tenant, never on an object the caller can create.

## Process mistakes (do not repeat)

- **A "read-only" test agent ran `prettier --write` and then
  `git checkout` on an uncommitted file**, wiping about 450 lines. The file
  was recovered from the agent's transcript (its full-file Read).
  - Before launching agents, snapshot the tree:
    `git update-ref refs/backup/<name> $(git stash create)` plus a tarball
    of untracked files.
  - Ban `--write`, `--fix`, `checkout`, `restore`, `stash` and `reset` in
    agent prompts.
  - Afterwards, grep the agent transcripts for those commands.
- Audit agents' findings were about 50% wrong in earlier sessions. Verify
  each one before fixing. In this round: "old tier names still live" was
  false; "slot-conflict anon grant is unneeded" was false (guests need it).
- `supabase migration up` was not usable because the local migration
  history had drifted. Instead, back up with
  `pg_dump -Fc`, apply each file with `psql -1`, then insert the version
  into `supabase_migrations.schema_migrations`.
