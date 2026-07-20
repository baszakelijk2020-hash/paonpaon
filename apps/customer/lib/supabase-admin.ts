import "server-only";

import { createSupabaseAdminClient } from "@paon/database";

import { env } from "./env";

/**
 * Service-role client. Only ever imported from the Stripe webhook
 * Route Handler (`app/api/webhooks/stripe/route.ts`) — a webhook has no
 * end-user session to run an RLS-scoped client under, and the write it
 * makes (`record_stripe_payment_event`) is itself the security
 * boundary, not RLS. See docs/DATABASE.md "Row Level Security".
 */
export function getSupabaseAdminClient() {
  return createSupabaseAdminClient(env.supabaseUrl, env.supabaseServiceRoleKey);
}
