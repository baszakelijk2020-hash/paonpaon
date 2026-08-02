"use server";

import { WeddingPartyRepository } from "@paon/database";
import {
  addWeddingPartyMemberSchema,
  asId,
  createWeddingAftercarePlanSchema,
  createWeddingPartySchema,
  updateWeddingPartyStatusSchema,
  type WeddingPartyMemberFittingStatus,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function createWeddingParty(formData: FormData) {
  const session = await requireModuleSession("enterprise_verticals");
  const value = createWeddingPartySchema.parse({
    organizerCustomerId: formData.get("organizerCustomerId"),
    eventDate: formData.get("eventDate") || undefined,
    eventTime: formData.get("eventTime") || undefined,
    venueName: formData.get("venueName") || undefined,
    fittingLocation: formData.get("fittingLocation") || undefined,
    notes: formData.get("notes") || undefined,
  });
  const repo = new WeddingPartyRepository(await getSupabaseServerClient());
  const party = await repo.create({
    retailerId: session.retailerId,
    organizerCustomerId: asId<"CustomerId">(value.organizerCustomerId),
    ...(value.eventDate ? { eventDate: value.eventDate } : {}),
    ...(value.eventTime ? { eventTime: value.eventTime } : {}),
    ...(value.venueName ? { venueName: value.venueName } : {}),
    ...(value.fittingLocation
      ? { fittingLocation: value.fittingLocation }
      : {}),
    ...(value.notes ? { notes: value.notes } : {}),
  });
  redirect(`/wedding-parties/${party.id}`);
}

export async function updateWeddingPartyStatus(formData: FormData) {
  await requireModuleSession("enterprise_verticals");
  const value = updateWeddingPartyStatusSchema.parse({
    weddingPartyId: formData.get("weddingPartyId"),
    status: formData.get("status"),
  });
  await new WeddingPartyRepository(
    await getSupabaseServerClient(),
  ).updateStatus(
    asId<"WeddingPartyId">(value.weddingPartyId),
    value.status as never,
  );
  revalidatePath(`/wedding-parties/${value.weddingPartyId}`);
}

export interface AddMemberState {
  formError?: string;
}

export async function addWeddingPartyMember(
  weddingPartyId: string,
  _prevState: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  await requireModuleSession("enterprise_verticals");
  const parsed = addWeddingPartyMemberSchema.safeParse({
    weddingPartyId,
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { formError: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const repo = new WeddingPartyRepository(await getSupabaseServerClient());
  try {
    await repo.addMember({
      weddingPartyId: asId<"WeddingPartyId">(weddingPartyId),
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role as never,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }
  revalidatePath(`/wedding-parties/${weddingPartyId}`);
  return {};
}

export async function updateMemberFittingStatus(formData: FormData) {
  await requireModuleSession("enterprise_verticals");
  const memberId = String(formData.get("memberId"));
  const status = formData.get("status") as WeddingPartyMemberFittingStatus;
  const weddingPartyId = String(formData.get("weddingPartyId"));
  await new WeddingPartyRepository(
    await getSupabaseServerClient(),
  ).updateMemberFittingStatus(memberId, status);
  revalidatePath(`/wedding-parties/${weddingPartyId}`);
}

export interface UpdatePartyScheduleState {
  formError?: string;
  success?: string;
}

export async function updatePartySchedule(
  partyId: string,
  _prev: UpdatePartyScheduleState,
  formData: FormData,
): Promise<UpdatePartyScheduleState> {
  await requireModuleSession("enterprise_verticals");
  const parsed = createWeddingPartySchema
    .omit({ organizerCustomerId: true })
    .safeParse({
      eventDate: formData.get("eventDate") || undefined,
      eventTime: formData.get("eventTime") || undefined,
      venueName: formData.get("venueName") || undefined,
      fittingLocation: formData.get("fittingLocation") || undefined,
      notes: formData.get("notes") || undefined,
    });
  if (!parsed.success) {
    return {
      formError:
        parsed.error.issues[0]?.message ?? "Check the schedule fields.",
    };
  }
  try {
    await new WeddingPartyRepository(
      await getSupabaseServerClient(),
    ).updateSchedule(asId<"WeddingPartyId">(partyId), {
      ...(parsed.data.eventDate ? { eventDate: parsed.data.eventDate } : {}),
      ...(parsed.data.eventTime ? { eventTime: parsed.data.eventTime } : {}),
      ...(parsed.data.venueName ? { venueName: parsed.data.venueName } : {}),
      ...(parsed.data.fittingLocation
        ? { fittingLocation: parsed.data.fittingLocation }
        : {}),
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
    });
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Update failed",
    };
  }
  revalidatePath(`/wedding-parties/${partyId}`);
  return { success: "Schedule saved." };
}

export interface CreateAftercarePlanState {
  formError?: string;
}

export async function createAftercarePlan(
  weddingPartyId: string,
  _prev: CreateAftercarePlanState,
  formData: FormData,
): Promise<CreateAftercarePlanState> {
  const session = await requireModuleSession("enterprise_verticals");
  const parsed = createWeddingAftercarePlanSchema.safeParse({
    weddingPartyId,
    weddingPartyMemberId: formData.get("weddingPartyMemberId") || undefined,
    instruction: formData.get("instruction"),
    dueOn: formData.get("dueOn") || undefined,
  });
  if (!parsed.success) {
    return {
      formError: parsed.error.issues[0]?.message ?? "Check the plan fields.",
    };
  }
  try {
    await new WeddingPartyRepository(
      await getSupabaseServerClient(),
    ).createAftercarePlan({
      retailerId: session.retailerId,
      weddingPartyId: asId<"WeddingPartyId">(parsed.data.weddingPartyId),
      ...(parsed.data.weddingPartyMemberId
        ? {
            weddingPartyMemberId: asId<"WeddingPartyMemberId">(
              parsed.data.weddingPartyMemberId,
            ),
          }
        : {}),
      instruction: parsed.data.instruction,
      ...(parsed.data.dueOn ? { dueOn: parsed.data.dueOn } : {}),
    });
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Could not save",
    };
  }
  revalidatePath(`/wedding-parties/${weddingPartyId}`);
  return {};
}
