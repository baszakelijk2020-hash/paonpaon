"use server";

import { ConciergeServiceRepository } from "@paon/database";
import {
  enrollConciergeServiceInputSchema,
  recordConciergeCostInputSchema,
  transitionConciergeBookingInputSchema,
  upsertConciergePlanDefinitionInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function upsertConciergePlan(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = upsertConciergePlanDefinitionInputSchema.parse({
    planDefinitionId: formData.get("planDefinitionId") || undefined,
    serviceKind: formData.get("serviceKind"),
    label: formData.get("label"),
    summary: formData.get("summary"),
    active: formData.get("active") !== "false",
  });
  const repo = new ConciergeServiceRepository(await getSupabaseServerClient());
  await repo.ensurePlanDefinitions(session.retailerId);
  await repo.upsertPlanDefinition(session.retailerId, parsed);
  revalidatePath("/settings/services");
}

export async function enrollConciergeCustomer(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const parsed = enrollConciergeServiceInputSchema.parse({
    customerId: formData.get("customerId"),
    planDefinitionId: formData.get("planDefinitionId"),
    advisorStaffId: formData.get("advisorStaffId") || undefined,
    commitmentNote: formData.get("commitmentNote") || undefined,
    status: formData.get("status") || "active",
  });
  await new ConciergeServiceRepository(
    await getSupabaseServerClient(),
  ).enrollService(session.retailerId, parsed);
  revalidatePath("/settings/services");
  revalidatePath(`/customers/${parsed.customerId}`);
}

export async function transitionConciergeBooking(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const parsed = transitionConciergeBookingInputSchema.parse({
    bookingId: formData.get("bookingId"),
    transition: formData.get("transition"),
    scheduledAt: formData.get("scheduledAt") || undefined,
    note: formData.get("note") || undefined,
  });
  await new ConciergeServiceRepository(
    await getSupabaseServerClient(),
  ).transitionBooking(parsed);
  revalidatePath("/settings/services");
  const customerId = formData.get("customerId");
  if (customerId) {
    revalidatePath(`/customers/${String(customerId)}`);
  }
}

export async function recordConciergeCost(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = recordConciergeCostInputSchema.parse({
    bookingId: formData.get("bookingId"),
    amountMinor: Number(formData.get("amountMinor")),
    currency: formData.get("currency"),
    description: formData.get("description"),
  });
  await new ConciergeServiceRepository(
    await getSupabaseServerClient(),
  ).recordCost(parsed);
  revalidatePath("/settings/services");
}
