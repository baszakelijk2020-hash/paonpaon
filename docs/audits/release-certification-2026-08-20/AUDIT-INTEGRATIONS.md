# PAON Human-Acceptance Audit — External Integrations

**Date:** 2026-08-21

Per the audit spec: "For every integration that credentials are now available for, perform a
real end-to-end test... If credentials remain unavailable: mark BLOCKED — CREDENTIALS
UNAVAILABLE. Do NOT fabricate a PASS."

Checked `.env.local` in all 3 apps (admin/retailer/customer) for real (non-empty, non-placeholder)
values. None found for any of the following — status unchanged from the original 2026-08-20
technical audit baseline:

| Integration                           | Status                                | Evidence                                                                                                                                  |
| ------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe (payments/billing)             | **BLOCKED — CREDENTIALS UNAVAILABLE** | `STRIPE_SECRET_KEY` empty across all apps' `.env.local`; `docs/PHASE.md` documents this as an intentional founder/legal blocker (ADR-062) |
| Stripe Connect                        | **BLOCKED — CREDENTIALS UNAVAILABLE** | Same                                                                                                                                      |
| Resend (transactional email)          | **BLOCKED — CREDENTIALS UNAVAILABLE** | `RESEND_API_KEY`/`RESEND_FROM_EMAIL` empty in admin `.env.local`                                                                          |
| Twilio (SMS)                          | **BLOCKED — CREDENTIALS UNAVAILABLE** | Not present in any `.env.local`                                                                                                           |
| OpenAI (AI image/generation features) | **BLOCKED — CREDENTIALS UNAVAILABLE** | `OPENAI_API_KEY` empty in retailer `.env.local`; multiple `docs/PHASE.md` items marked `blocked_external` on this key                     |
| Shopify                               | **BLOCKED — CREDENTIALS UNAVAILABLE** | Not present in any `.env.local`; PHASE.md notes Shopify/Faden scheduled execution as blocked                                              |

No real end-to-end test was performed for any of these — per the spec, a fabricated PASS
would be worse than an honest BLOCKED. Code-level graceful-degradation behavior (503/disabled
UI state when a key is missing) was inspected in the earlier technical audit
(`AUDIT-DEPLOYMENT-RELIABILITY.md`) but that is not the same as a real credentialed test.

**No change in status from the prior audit.** If real credentials become available, this
integration set needs a dedicated, separate testing pass — it was explicitly out of scope for
this human-acceptance pass given no credentials exist in this environment.
