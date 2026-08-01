"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  AppointmentRepository,
  RetailerBranchRepository,
} from "@paon/database";
import {
  asId,
  createAppointmentInputSchema,
  wallTimeInZoneToUtcIso,
} from "@paon/domain";
import { redirect } from "next/navigation";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CreateAppointmentFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
}

/**
 * `datetime-local` submits an offset-less wall clock. Interpret it in the
 * selected branch timezone (fallback UTC) via domain helper.
 */
function toIsoInZone(
  datetimeLocalValue: string,
  timeZone: string,
): string | null {
  const [date, time] = datetimeLocalValue.split("T");
  if (!date || !time) return null;
  const hhmm = time.slice(0, 5);
  try {
    return wallTimeInZoneToUtcIso(date, hhmm, timeZone);
  } catch {
    return null;
  }
}

export async function createAppointment(
  _prevState: CreateAppointmentFormState,
  formData: FormData,
): Promise<CreateAppointmentFormState> {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const supabase = await getSupabaseServerClient();
  const branchRepo = new RetailerBranchRepository(supabase);
  const branches = await branchRepo.listByRetailer(session.retailerId);
  const selectedBranch =
    branches.find((branch) => branch.id === raw["branchId"]) ??
    branches.find((branch) => branch.isDefault) ??
    branches[0] ??
    null;
  const timeZone = selectedBranch?.timezone ?? "UTC";

  const startsAt = toIsoInZone(raw["startsAt"] ?? "", timeZone);
  const endsAt = toIsoInZone(raw["endsAt"] ?? "", timeZone);

  const parsed = createAppointmentInputSchema.safeParse({
    customerId: raw["customerId"],
    type: raw["type"],
    startsAt: startsAt ?? raw["startsAt"],
    endsAt: endsAt ?? raw["endsAt"],
    staffId: raw["staffId"] || undefined,
    branchId: (selectedBranch?.id ?? raw["branchId"]) || undefined,
    notes: raw["notes"] || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { values: raw, fieldErrors };
  }

  if (parsed.data.startsAt >= parsed.data.endsAt) {
    return {
      values: raw,
      fieldErrors: { endsAt: "End time must be after the start time" },
    };
  }

  const appointment = await new AppointmentRepository(supabase).create({
    retailerId: session.retailerId,
    customerId: asId<"CustomerId">(parsed.data.customerId),
    type: parsed.data.type,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    ...(parsed.data.staffId
      ? { staffId: asId<"StaffId">(parsed.data.staffId) }
      : {}),
    ...(parsed.data.branchId
      ? { branchId: asId<"RetailerBranchId">(parsed.data.branchId) }
      : {}),
    ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
  });

  redirect(`/appointments/${appointment.id}`);
}
