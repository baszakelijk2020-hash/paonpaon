import "server-only";

import { createSupabaseAdminClient } from "@paon/database";

import { env } from "./env";

/**
 * Service-role client. Allowed call sites:
 * - Stripe webhook Route Handler (`app/api/webhooks/stripe/route.ts`) —
 *   no end-user session; `record_stripe_payment_event` is the boundary.
 * - Wedding-party join photo upload after `join_wedding_party` — the
 *   joiner is anonymous and storage RLS is organizer/staff-only
 *   (ADR-055). The invite token already gated membership creation.
 *
 * See docs/DATABASE.md "Row Level Security".
 */
export function getSupabaseAdminClient() {
  return createSupabaseAdminClient(env.supabaseUrl, env.supabaseServiceRoleKey);
}
