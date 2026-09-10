import "server-only";

import { CustomerRepository } from "@paon/database";
import { type UserId } from "@paon/domain";
import { cache } from "react";

import { getSupabaseServerClient } from "./supabase-server";

/**
 * The signed-in user's customer records, deduplicated per request.
 *
 * Every dashboard tab ran `new CustomerRepository(supabase).findByUserId(session.userId)`
 * for itself, and `/dashboard` ran it twice in one render because `RoutineSections`
 * resolves independently of the page around it. Identical query, same request, paid
 * again each time.
 *
 * `cache()` keys on the argument, so all callers in one request share a single query
 * while different users still resolve separately. Call this instead of constructing a
 * CustomerRepository at each call site.
 */
export const getCustomersForUser = cache(async function getCustomersForUser(
  userId: UserId,
) {
  const supabase = await getSupabaseServerClient();
  return new CustomerRepository(supabase).findByUserId(userId);
});
