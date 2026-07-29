# 12 — Feature inventory

**Snapshot date: 2026-07-29.**  
Categories are judgment from code + docs + ADR-051. **Production Ready**
means “appears operable in deployed apps with seeded data,” not “proven with
paying pilots.” Provider-backed features may be Functional in code but not
live-proven.

Legend: **PR** Production Ready · **F** Functional · **P** Partial ·
**S** Scaffolded · **Pl** Planned (docs only) · **D** Deprecated ·
**E** Experimental.

| Feature                                | Category | Evidence notes                                                            |
| -------------------------------------- | -------- | ------------------------------------------------------------------------- |
| Monorepo / CI / shared packages        | PR       | Working tree + CI                                                         |
| Platform auth + retailer onboarding    | PR       | Admin/retailer flows + e2e                                                |
| Retailer staff invites/roles           | F        | Present                                                                   |
| Customer auth + account linking        | F        | Present                                                                   |
| CustomerPreferences UI                 | F        | `/account`                                                                |
| Wishlist                               | F        | ADR-026                                                                   |
| Product / variant / collection CRUD    | F        | Retailer UI + DB                                                          |
| Path storefront `paon-template.html`   | F        | Live URL documented; heuristic facets                                     |
| Draft cart + checkout UI               | F        | Code complete; Stripe live Unknown                                        |
| Stripe Connect payments                | P        | Code + webhook; credentials historically missing                          |
| Stripe Billing subscriptions           | P        | Same                                                                      |
| Appointments + availability            | F        | UI + tables                                                               |
| Garment-first alterations workflow     | P        | Domain/DB deep; founder UI gated (PHASE)                                  |
| Customer alteration tracking           | F/P      | Views + portal                                                            |
| Loyalty / rewards / referrals          | F        | Foundation shipped                                                        |
| Retailer events + RSVP                 | F        | Present                                                                   |
| Clienteling notes                      | F        | Present                                                                   |
| Messaging + notifications              | F        | Present                                                                   |
| Email outbox + Resend dispatch         | P        | Cron exists; Resend live Unknown                                          |
| SMS/WhatsApp outbox + Twilio           | P        | Same                                                                      |
| Newsletter digest cron                 | P        | Handler exists; not in vercel.json crons                                  |
| Behavioral events / analytics pages    | F        | Present                                                                   |
| AI next-best-action                    | P/E      | Code; OpenAI live Unknown                                                 |
| AI Today’s Pick                        | P/E      | Same                                                                      |
| AI communication_draft                 | S/Pl     | Kind only                                                                 |
| Wedding parties                        | F        | Flows + ADR-055 fields                                                    |
| Staff roster / shifts                  | F        | Present                                                                   |
| Brand theme versions                   | F        | Present                                                                   |
| Commercial inquiries                   | F        | Marketing + admin                                                         |
| Prospects + Demo Studio config         | P        | Config/versioning; synthetic generation may be incomplete (PROJECT_STATE) |
| Published demo `/demo/[token]`         | P        | Exists; depth Unknown without runtime check                               |
| Marketing site routes                  | P        | Some routes historically stubby (ADR-051)                                 |
| Admin AI monitoring                    | F        | List UI                                                                   |
| Demo mode persona launcher             | F        | Admin                                                                     |
| ProductionOrder / supplier connectors  | Pl/S     | Domain type only; no table                                                |
| Public API `/api/v1`                   | Pl       | Documented not started                                                    |
| Metadata graph                         | Pl       | Vision only                                                               |
| Wardrobe twin / scoring / roadmap      | Pl       | Vision only                                                               |
| Colour intelligence / embeddings       | Pl       | Vision only                                                               |
| PriceAdjustment / promotions (ADR-050) | Pl/S     | ADR without code symbols                                                  |
| CustomerFitProfile                     | D        | Legacy tables; ADR-016                                                    |
| Legacy alteration tables               | D        | Renamed `legacy_*`                                                        |
| Prisma / Made-to-Munro root trackers   | D        | Orphan                                                                    |
| Fit tools / silhouette (`vox-`)        | P        | Ported; supplier integration parked (PHASE)                               |
| Offline / native apps                  | Pl       | NON_GOALS                                                                 |

## How to use this list

Before treating any row as Production Ready in a sales conversation, verify
against live env credentials and a manual path on the deployed URLs in
[DEPLOYMENT.md](../DEPLOYMENT.md). This inventory is **not** a substitute for
that check.
