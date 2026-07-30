"use server";

import {
  AppointmentCloseoutRepository,
  BranchCalendarRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  asId,
  factsFromAppointmentCloseout,
  retailerRoleAtLeast,
  validateBranchCalendarEntryDraft,
  validateBranchDraft,
  type AppointmentCloseoutOutcome,
  type BranchCalendarEntryType,
  type CloseoutRectangleKind,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function createBranch(args: {
  readonly name: string;
  readonly timezone: string;
  readonly isPrimary?: boolean;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    return { ok: false, error: "Manager access required" };
  }
  const validation = validateBranchDraft(args);
  if (!validation.ok) {
    return { ok: false, error: validation.errors.join(", ") };
  }
  const supabase = await getSupabaseServerClient();
  await new BranchCalendarRepository(supabase).createBranch({
    retailerId: session.retailerId,
    name: args.name,
    timezone: args.timezone,
    ...(args.isPrimary ? { isPrimary: true } : {}),
  });
  revalidatePath("/settings/branches");
  revalidatePath("/appointments/calendar");
  return { ok: true };
}

export async function createBranchCalendarEntry(args: {
  readonly branchId: string;
  readonly entryType: BranchCalendarEntryType;
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly assignedStaffIds?: readonly string[];
  readonly customerId?: string;
  readonly notes?: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    return { ok: false, error: "Manager access required" };
  }
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  const validation = validateBranchCalendarEntryDraft({
    entryType: args.entryType,
    startsAt: args.startsAt,
    endsAt: args.endsAt,
    assignedStaffIds: (args.assignedStaffIds ?? []).map((id) =>
      asId<"StaffId">(id),
    ),
    ...(args.customerId
      ? { customerId: asId<"CustomerId">(args.customerId) }
      : {}),
  });
  if (!validation.ok) {
    return { ok: false, error: validation.errors.join(", ") };
  }
  await new BranchCalendarRepository(supabase).createEntry({
    retailerId: session.retailerId,
    branchId: asId<"BranchId">(args.branchId),
    entryType: args.entryType,
    title: args.title,
    startsAt: args.startsAt,
    endsAt: args.endsAt,
    assignedStaffIds: (args.assignedStaffIds ?? []).map((id) =>
      asId<"StaffId">(id),
    ),
    ...(args.customerId
      ? { customerId: asId<"CustomerId">(args.customerId) }
      : {}),
    ...(args.notes ? { notes: args.notes } : {}),
    ...(staff ? { createdByStaffId: staff.id } : {}),
  });
  revalidatePath("/appointments/calendar");
  return { ok: true };
}

export async function recordAppointmentCloseout(args: {
  readonly appointmentId: string;
  readonly customerId: string;
  readonly outcome: AppointmentCloseoutOutcome;
  readonly selections: readonly {
    readonly conceptId: string;
    readonly kind: CloseoutRectangleKind;
    readonly label: string;
    readonly polarity: "positive" | "negative";
  }[];
  readonly followUpNotes?: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "sales_associate")) {
    return { ok: false, error: "Sales access required" };
  }
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) {
    return { ok: false, error: "Staff identity required" };
  }
  const observedAt = new Date().toISOString();
  const validation = factsFromAppointmentCloseout({
    retailerId: session.retailerId,
    appointmentId: asId<"AppointmentId">(args.appointmentId),
    customerId: asId<"CustomerId">(args.customerId),
    authorStaffId: staff.id,
    outcome: args.outcome,
    observedAt,
    selections: args.selections.map((selection) => ({
      conceptId: asId<"MetadataConceptId">(selection.conceptId),
      kind: selection.kind,
      label: selection.label,
      polarity: selection.polarity,
    })),
    ...(args.followUpNotes ? { followUpNotes: args.followUpNotes } : {}),
  });
  if (!validation.ok && args.outcome !== "no_show_confirmed") {
    const hasContent =
      args.selections.length > 0 || Boolean(args.followUpNotes?.trim());
    if (!hasContent) {
      return {
        ok: false,
        error: validation.errors.join(", ") || "Invalid closeout",
      };
    }
  }
  try {
    await new AppointmentCloseoutRepository(supabase).recordCloseout({
      retailerId: session.retailerId,
      appointmentId: asId<"AppointmentId">(args.appointmentId),
      staffId: staff.id,
      outcome: args.outcome,
      selections: args.selections,
      ...(args.followUpNotes ? { followUpNotes: args.followUpNotes } : {}),
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not record closeout",
    };
  }
  revalidatePath(`/appointments/${args.appointmentId}`);
  return { ok: true };
}
