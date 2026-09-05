"use server";

import { CustomerRepository, StyleProfileRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function resolveCustomer(retailerId: string) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find((row) => row.retailerId === retailerId);
  if (!customer) throw new Error("Customer relationship not found.");
  return { customer, supabase };
}

/**
 * Every tap — archetype or personal tweak — declares a real positive style
 * preference through the existing `upsert_declared_style_preference` RPC.
 * There is no separate "quiz answer" table: the quiz is a curated,
 * low-friction on-ramp onto the style profile that already drives
 * MorningRoutine ranking and shows up in Settings.
 */
export async function declareStyleQuizChoice(
  retailerId: string,
  conceptId: string,
): Promise<void> {
  const { customer, supabase } = await resolveCustomer(retailerId);
  await new StyleProfileRepository(supabase).upsertDeclared(customer.id, {
    conceptId: asId<"MetadataConceptId">(conceptId),
    polarity: "positive",
  });
  // Deliberately not revalidating "/style-quiz" itself: this action fires
  // mid-flow, one tap at a time, and refetching this route's server props
  // while the client component still has an in-progress `step` in local
  // state would jump straight to the "already answered" summary instead of
  // letting the remaining tweak questions render.
  revalidatePath("/account");
  revalidatePath("/dashboard");
  revalidatePath("/morning-routine");
}
