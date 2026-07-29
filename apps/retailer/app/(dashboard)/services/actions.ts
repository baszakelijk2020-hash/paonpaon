"use server";

import { ServicePlanRepository } from "@paon/database";
import {
  assignServiceAdvisorInputSchema,
  enrollServiceMembershipInputSchema,
  grantServiceEntitlementInputSchema,
  linkServiceBookingAppointmentInputSchema,
  recordServiceCareInputSchema,
  recordServiceCostInputSchema,
  recordServiceFulfilmentInputSchema,
  requestServiceBookingInputSchema,
  setServiceMembershipStatusInputSchema,
  transitionServiceBookingInputSchema,
  upsertServicePlanInputSchema,
  type ServicePlanStatus,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function revalidateServices(): void {
  revalidatePath("/services");
}

export async function upsertServicePlan(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = upsertServicePlanInputSchema.parse({
    planId: formData.get("planId") || undefined,
    kind: formData.get("kind"),
    status: formData.get("status") || "draft",
    title: formData.get("title"),
    summary: formData.get("summary"),
    explanation: formData.get("explanation"),
  });
  await new ServicePlanRepository(await getSupabaseServerClient()).upsertPlan(
    session.retailerId,
    parsed,
  );
  revalidateServices();
}

export async function setServicePlanStatus(formData: FormData): Promise<void> {
  const session = await requireSession();
  const planId = String(formData.get("planId") ?? "");
  const status = String(formData.get("status") ?? "") as ServicePlanStatus;
  await new ServicePlanRepository(
    await getSupabaseServerClient(),
  ).setPlanStatus(session.retailerId, planId, status);
  revalidateServices();
}

export async function enrollServiceMembership(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const parsed = enrollServiceMembershipInputSchema.parse({
    planId: formData.get("planId"),
    customerId: formData.get("customerId"),
    advisorStaffId: formData.get("advisorStaffId") || undefined,
    commitmentNotes: formData.get("commitmentNotes") || undefined,
    seedDefaultEntitlements:
      formData.get("seedDefaultEntitlements") !== "false",
  });
  await new ServicePlanRepository(
    await getSupabaseServerClient(),
  ).enrollMembership(parsed);
  revalidateServices();
}

export async function setMembershipStatus(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = setServiceMembershipStatusInputSchema.parse({
    membershipId: formData.get("membershipId"),
    status: formData.get("status"),
  });
  await new ServicePlanRepository(
    await getSupabaseServerClient(),
  ).setMembershipStatus(parsed);
  revalidateServices();
}

export async function assignAdvisor(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = assignServiceAdvisorInputSchema.parse({
    membershipId: formData.get("membershipId"),
    advisorStaffId: formData.get("advisorStaffId"),
  });
  await new ServicePlanRepository(
    await getSupabaseServerClient(),
  ).assignAdvisor(parsed);
  revalidateServices();
}

export async function grantEntitlement(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = grantServiceEntitlementInputSchema.parse({
    membershipId: formData.get("membershipId"),
    kind: formData.get("kind"),
    quantity: formData.get("quantity"),
    idempotencyKey:
      formData.get("idempotencyKey") ||
      `grant-${String(formData.get("membershipId"))}-${String(formData.get("kind"))}-${Date.now()}`,
    notes: formData.get("notes") || undefined,
  });
  await new ServicePlanRepository(
    await getSupabaseServerClient(),
  ).grantEntitlement(parsed);
  revalidateServices();
}

export async function requestBooking(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = requestServiceBookingInputSchema.parse({
    membershipId: formData.get("membershipId"),
    kind: formData.get("kind"),
    notes: formData.get("notes") || undefined,
    idempotencyKey:
      formData.get("idempotencyKey") ||
      `staff-book-${String(formData.get("membershipId"))}-${Date.now()}`,
  });
  await new ServicePlanRepository(
    await getSupabaseServerClient(),
  ).requestBooking(parsed);
  revalidateServices();
}

export async function transitionBooking(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = transitionServiceBookingInputSchema.parse({
    bookingId: formData.get("bookingId"),
    status: formData.get("status"),
    commitmentNotes: formData.get("commitmentNotes") || undefined,
    consumeEntitlement: formData.get("consumeEntitlement") !== "false",
  });
  await new ServicePlanRepository(
    await getSupabaseServerClient(),
  ).transitionBooking(parsed);
  revalidateServices();
}

export async function linkAppointment(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = linkServiceBookingAppointmentInputSchema.parse({
    bookingId: formData.get("bookingId"),
    appointmentId: formData.get("appointmentId"),
  });
  await new ServicePlanRepository(
    await getSupabaseServerClient(),
  ).linkAppointment(parsed);
  revalidateServices();
}

export async function recordFulfilment(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = recordServiceFulfilmentInputSchema.parse({
    bookingId: formData.get("bookingId"),
    method: formData.get("method"),
    status: formData.get("status") || "scheduled",
    notes: formData.get("notes") || undefined,
  });
  await new ServicePlanRepository(
    await getSupabaseServerClient(),
  ).recordFulfilment(parsed);
  revalidateServices();
}

export async function recordCare(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = recordServiceCareInputSchema.parse({
    membershipId: formData.get("membershipId"),
    careKind: formData.get("careKind"),
    summary: formData.get("summary"),
    bookingId: formData.get("bookingId") || undefined,
    wardrobeItemId: formData.get("wardrobeItemId") || undefined,
    alterationId: formData.get("alterationId") || undefined,
  });
  await new ServicePlanRepository(await getSupabaseServerClient()).recordCare(
    parsed,
  );
  revalidateServices();
}

export async function recordCost(formData: FormData): Promise<void> {
  await requireSession();
  const parsed = recordServiceCostInputSchema.parse({
    membershipId: formData.get("membershipId"),
    label: formData.get("label"),
    amountMinorUnits: formData.get("amountMinorUnits"),
    currency: formData.get("currency") || "EUR",
    bookingId: formData.get("bookingId") || undefined,
    notes: formData.get("notes") || undefined,
  });
  await new ServicePlanRepository(await getSupabaseServerClient()).recordCost(
    parsed,
  );
  revalidateServices();
}
