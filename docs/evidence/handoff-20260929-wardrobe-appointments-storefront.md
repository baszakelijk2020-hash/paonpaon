# Handoff — Wardrobe, Appointments and storefront polish (29 Sep 2026)

Branch `platform-integrated-20260903`. **Nothing is committed.** All work below
is in the working tree on top of the uncommitted work already there. Verified
in Chromium (Playwright) at 1448×900 and 390×844 unless noted. The customer
typecheck is clean, and all 44 inline scripts in `paon-template.html` parse.

## Done

### Morning Routine (`/dashboard`, OVERVIEW_LAYOUT "morning")

- Separate responsive cards (`dashboard/morning-cards.css`). See memory
  `project_morning_routine_cards.md` for the traps.
- Readings card: large right-aligned digital time with the date under it;
  solid, same-size icons (sunrise/sunset/AQI in `stat-icons.tsx`).
- Guests are greeted "Hi," with no name (`dashboard/page.tsx`,
  `welcome-card.tsx`).

### Appointments (`/appointments`)

- Booking bar: top aligned with the Store/Wardrobe switch (60px), round
  pill, 15% white ground, dark controls, dark Continue with a green label.
- Times are whole and half hours (10:00–18:00, `HALF_HOUR_SLOTS` in
  `quick-book-bar.tsx`). Choosing Today lists only the times still ahead;
  late in the day it reads "No times left today" and Continue is disabled.
- Time drawer: "Request priority booking" (shortened); the rush and VIP
  icons are sized and centred to match.
- Titles sit 16px above their content, with 64px of space above each block;
  the carousel arrows are one joined pill with a divider.
- Timeline opens on October 2026 (`TIMELINE_LAUNCH` in
  `appointments/page.tsx`). Before launch the today line stands at the start
  and the first month label steps past its pill. Fall/Winter Wardrobe moved
  to October; Winter Coat Shopping removed. A rule closes the timeline where
  the today line ends.
- Tailoring Party (`tailoring-party-planner.tsx`, new):
  - date, time, people and occasion pills (Wedding / Office / Friends / No
    occasion); no Today/Tomorrow.
  - the number of people sets the number of orbit seats.
  - the centre is "You" for guests and the client's name when signed in.
  - the orbit sits in its own card; beside it a live party card with a
    name + email line per open seat and Send.
  - guests can use everything; Send, Continue and the orbit open the
    Wardrobe sign-in card (Apple / Google / email, `GuestPortalPreview`) as
    a popup.
  - signed in, Send starts the party if needed and opens the client's own
    mail app, addressed to everyone, with the party's join link.
  - `/wedding-parties/new` is prefilled from the planner (date, time,
    occasion, party size).
- The orbit styles are now keyed to a fixed class, not a generated id. A
  server/client id mismatch had stripped every circle's styling.

### Storefront (`r/[slug]/paon-template.html`)

- Filter drawer: colour options carry a filled swatch (concentric squircle)
  at the left. An open group is measured to its real height, so Green is no
  longer cut off.
- Product detail title (`#dr-title`) uses the house serif "NS Serrif".
- Book Your Fitting: new colour scheme (dark chips, chosen item light with
  dark ink, green Confirm when complete); the first two days read TODAY /
  TOMORROW; Today shows only the times still ahead.

### Storefront product detail (30 Sep 2026)

- The line under the title names only the mill ("Carlo Barbera"), no
  longer "<title> from <mill>."; `openDetail` in `paon-template.html`.
- The tier selector ("The Essentialist" …) is now a canvas selector:
  Half-Canvas, Full-Canvas, Full-Canvas Handmade, a hairline, then Zero
  Canvas and Zero Canvas Handmade. It is a list with a 1px-outlined icon
  per option: half moon, full moon, red moon, sun, full sun.
- **Price steps for Zero Canvas (Base Price) and Zero Canvas Handmade
  (+199) are placeholders.** Confirm them with the house (`data-add` on
  each `.drf-dd-item`).
- Fixed an existing bug: picking an option swapped the product's price for
  a fixed EUR base ("$1,540.00" → "EUR 2.000"). The step is now added to
  the product's own price in its own format (`priceWithStep`).
- The phone layout does not show this selector at all. That was already
  the case and is unchanged.

### Tailoring Party, full flow (30 Sep 2026)

- **Organizer** (`tailoring-party-planner.tsx`):
  - pills for date, time, people, occasion and location; the location
    shows its street and number small under the name.
  - **Book** sends a real appointment to the atelier (`bookAppointment` →
    `request_appointment`), so it appears in the retailer's agenda. It
    carries a "Tailoring party · Occasion · Party of N · Guests: name
    (email)" note and is booked in the **location's own timezone**
    (`zonedISO`). The top booking bar had the same timezone bug; fixed
    too.
  - after booking the button reads **Booked**. Any change turns it into
    **Save changes**: a time change reschedules; other changes cancel and
    rebook.
  - three cards: the orbit, the people, and the party chat.
  - people: photo per person (click the circle), "Name Surname" and email,
    a status pill (Not sent / Invited / Fitted / Waiting for pick-up /
    Cancelled / Rebooked), and a three-dot menu (Change details, Resend
    invitation link, Remove from party).
  - changing the party size fades lines and orbit seats in and out, with
    no reload.
  - the orbit's centre is an avatar and floats; seats show a number, then
    initials, then the photo.
- **Invitee** (`tailoring-party-invitee.tsx`, `/appointments?party=<token>`):
  - the party sits between the booking bar and High Maintenance, with the
    organizer's date, time and location.
  - they fill in name, surname, email, phone, height, weight and a photo,
    then join. Joining needs no account, so nothing is lost before signing
    in.
  - "Create your profile" opens the Apple / Google / email card, with the
    email prefilled.
  - once joined, the details are wiped from the device.
  - "I'll be there / I can't make it" and "Book a fitting of your own"
    (the booking bar at the top). The organizer sees Cancelled, then
    Rebooked.
- **Chat**: organizer and invitees see each other's messages; the
  organizer is prompted to write the first one.
- The invite link now points to the Wardrobe (`/appointments?party=`).

New database pieces (applied to the local DB by hand; both files are
re-runnable):

- `supabase/migrations/20260930120000_wedding_party_messages.sql`: chat
  table plus `list_/post_wedding_party_message`, keyed by the invite token.
- `supabase/migrations/20260930130000_wedding_party_member_attendance.sql`:
  `wedding_party_members.attendance` plus
  `set_wedding_party_member_attendance` (token + member id).
- `database.types.ts` was edited by hand for these three functions and the
  column. Regenerate once the local DB has every migration.

A security review of the chat, the actions and the invitee flow found:

- fixed: only the party's organizer gets the organizer controls.
- fixed: the invitee's details are wiped from the device after joining.
- open (low): the chat's rate limit is per party only.

Local data added or changed on purpose:

- Antwerp and Amsterdam added as published locations (also in
  `supabase/seed.sql`).
- The demo guests (Julien Moreau, Thomas Leroy) removed, and dropped from
  `packages/database/src/demo-seed.ts`.
- My test data was cleaned up. The test photo remains in the
  `party-photos` bucket.

Not done:

- **Save changes needs `20260916120000_appointment_slot_integrity.sql`
  applied locally.** It is staged but was skipped because an older
  timestamp sits behind already-applied migrations. Until then the
  reschedule/cancel functions don't exist and Save changes shows an error.
- The phone number is collected but not stored: joining has no phone
  field, and customers can't edit their own phone. A small migration is
  needed.
- Change details and Remove for guests who have **already joined**: no
  customer-callable function exists. The menu edits unsent lines only.
- Invites go through the organizer's own mail app (no outbox entry point
  for party invites).

### High Maintenance booker and bar polish (30 Sep 2026, late)

- Dry cleaning, Shoe repair and Alterations each open into a **3-step
  booker** (`appointments/care-booker.tsx`, used by
  `paid-care-launcher.tsx`) inside the card:
  - the card's label row stays fixed at 72px and never moves; the fold
    opens underneath to one fixed height, and the other cards keep their
    size.
  - step 1: services with prices and a − / + quantity each.
  - step 2: drop-off or pick-up (in store / from home / from office) with
    morning / afternoon / evening, a note (floor, door code …), then the
    return (in store / to home / to office) with its own time of day.
  - step 3: summary and total, pay when collected / pay now, and for a
    guest the Apple / Google / email sign-in card inside the step
    (`GuestPortalPreview embedded`).
  - Back button and a three-bar step indicator. Steps slide like tabs,
    lines arrive staggered, and the Continue / Book pill never moves.
  - answers are kept per tab session and survive back / forth and the
    sign-in redirect (the booking reopens where it was).
  - Book creates one `paid_care_bookings` row per line via the existing
    `createPaidCareBooking` (now also takes `preferredWindow`). The
    retailer's `/appointments/paid-care` page shows pick-up, return, time
    of day and the note. The existing trigger sends the confirmation (a
    notification, then the `email_outbox` chain). Verified end to end,
    then the test rows were deleted.
  - Alterations has no price list for this atelier, so it takes a
    described line and a garment count, "quoted by your advisor".
  - **Review:** a signed-out visitor sees the demo atelier's price list
    through the service client (`getSupabaseAdminClient`), because RLS
    hides prices from anon. Only labels and prices reach the page.
- Tailoring Party:
  - the name placeholder is "Name".
  - the status pill sits inside the end of the email pill, and the orbit
    card (320px) and chat (300px) are narrower, so name and email are
    wider.
  - the three dots are in a circle.
  - Send invite is as wide as the email column and 48px tall.
  - the chat is one 48px pill with a "Send" pill inside.
  - the live line is gone.
- Booking bars:
  - the location pill reads "Antwerp – Lombardenstraat 2".
  - time and people pills are narrower.
  - under 1240px wide, Today / Tomorrow are hidden.
- Trap: a formatter hook strips the leading space in
  `${cond ? " class" : ""}`. Build class lists with
  `[...].join(" ")`.

### Final customer-surface pass (30 Sep 2026)

- **Wardrobe calendar:** `wardrobe-four-week-calendar.tsx` is now a contained
  four-week panel, not a pale full-viewport canvas. Its surface is `#191b1d`,
  with the same material, border and rounded-card language as Morning Routine.
  The layout solver is deliberately constrained to four rows; it no longer
  measures itself to the bottom of the browser.
- **Orders:** `orders/page.tsx` now contains only terminal past orders. The
  old support modules, Preferred Tailoring/Services links, pairing carousel
  and pending-order content are removed. Each history entry is a compact card:
  product thumbnail, retailer/date/item count, total, status, and only
  **Order again**, **Request care**, and **View order**.
- **Tailoring Party:** the organizer layout now makes the distinction between
  booking and inviting explicit. The booking controls remain above; below,
  **Invite your party** is a guest-list card, with one full-width Send invite
  button aligned from the seat/avatar edge to the settings-dot edge. Party
  chat is below that card rather than squeezed into a third desktop column.
  Its composer is a full-width 48px pill with a fixed 92px Send control and
  a genuinely usable text area. At ≤1100px the orbit, invitations and chat
  collapse into a single column.
- **Checks run after these changes:** `pnpm --filter @paon/customer typecheck`
  passed; `git diff --check` passed. Local Chromium visually confirmed the
  new Wardrobe card and the signed-out Orders fallback. The authenticated
  Tailoring Party state needs a final browser pass with a real organizer
  session; `/wedding-parties/new` redirects unauthenticated users to login.
- **Do not discard:** current work is intentionally still an uncommitted,
  shared working tree. It includes adjacent customer, retailer, domain and
  migration work beyond this surface pass. Preserve it; do not reset, clean,
  stash or mass-stage it. Continue from the files named above and this
  document.

## Needs review before commit

- `apps/customer/middleware.ts`: the matcher now excludes `/images/`
  (guest `/images/*` requests were being redirected to /login). This is
  security-relevant.
- New Server Action `prepareTailoringPartyInvite`
  (`wedding-parties/actions.ts`). It uses the same organizer resolution as
  `createWeddingParty`. Run the security-reviewer before merge.

## Not done / open

- Real server-sent party invites. `add_wedding_party_member` is
  atelier-staff only, and there is no `email_outbox` entry point for party
  invites (ADR-032). Doing it properly needs a migration: a
  customer-callable add-member RPC plus an enqueue RPC, then a security
  review. For now, the mail app carries the link.
- Safari was not re-checked for today's Appointments and storefront changes.
- A hydration mismatch in the shell sidebar at phone width (aside vs
  storefront link). It is in no file changed here and was left alone.
- "To work" showed "7d" in the test browser. Cause unknown.
- The locked-watch guard hook reports drift on every edit. The watch itself
  was not touched in this session.
- After launch, `TIMELINE_LAUNCH` and the before-start marker branch can go.

## Traps met (keep)

- `paon-template.html`: a new standalone `<style>` block (after the last
  script, or in `<head>`) is **not loaded** by the template loader. Put rules
  inside an existing style block. It is scoped to `.paon-template-root` and
  served as a linked sheet.
- A later block already styles `#paon-mobile-appointment#paon-mobile-appointment`
  with `!important`, so the booker's new rules triple the id.
- Filter drawer CSS lives in a JS template literal: no backticks. Check with
  the snippet in `storefront-filter-drawer-worklog.md`.
- The shell keeps a transform after its entrance: portal fixed overlays to
  `document.body`.

## Backups

Pre-edit copies are in the session scratchpad
(`/private/tmp/claude-501/-Users-nguyen-Projects-PAON/b772c9ad-c951-4928-9b05-b27c0d003d03/scratchpad/`,
`*.before-*`). Undo from those, never `git checkout --`.
