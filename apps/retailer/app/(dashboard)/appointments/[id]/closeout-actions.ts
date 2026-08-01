"use server";

import {
  AppointmentCloseoutRepository,
  AppointmentRepository,
  CustomerFactRepository,
  CustomerMomentRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  asId,
  buildAppointmentCloseout,
  isSupportedTimeZone,
  type AdvisorRectangleKind,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function submitAppointmentCloseout(args: {
  readonly appointmentId: string;
  readonly customerId: string;
  readonly selections: readonly {
    readonly conceptId: string;
    readonly kind: AdvisorRectangleKind;
    readonly label: string;
    readonly polarity: "positive" | "negative";
  }[];
  readonly freeformNote?: string;
  readonly nextStep?: string;
  readonly followUpDate?: string;
}): Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: string }
> {
  const session = await requireModuleSession("relationship_intelligence");
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) {
    return { ok: false, error: "Staff identity required" };
  }

  const appointment = await new AppointmentRepository(supabase).findById(
    asId<"AppointmentId">(args.appointmentId),
  );
  if (!appointment || appointment.retailerId !== session.retailerId) {
    return { ok: false, error: "Appointment not found" };
  }

  const observedAt = new Date().toISOString();
  const validation = buildAppointmentCloseout({
    retailerId: session.retailerId,
    customerId: asId<"CustomerId">(args.customerId),
    appointmentId: appointment.id,
    authorStaffId: staff.id,
    observedAt,
    selections: args.selections,
    ...(args.freeformNote ? { freeformNote: args.freeformNote } : {}),
    ...(args.nextStep ? { nextStep: args.nextStep } : {}),
    ...(args.followUpDate ? { followUpDate: args.followUpDate } : {}),
  });
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.errors.join(", ") || "Invalid closeout",
    };
  }

  try {
    await new CustomerFactRepository(supabase).recordAdvisorRectangles({
      retailerId: session.retailerId,
      customerId: asId<"CustomerId">(args.customerId),
      staffId: staff.id,
      observedAt,
      selections: args.selections,
      freeformNote: validation.freeformNote,
    });
    await new AppointmentCloseoutRepository(supabase).record({
      retailerId: session.retailerId,
      appointmentId: appointment.id,
      customerId: asId<"CustomerId">(args.customerId),
      staffId: staff.id,
      ...(args.freeformNote ? { freeformNote: args.freeformNote } : {}),
      ...(args.nextStep ? { nextStep: args.nextStep } : {}),
      ...(args.followUpDate ? { followUpDate: args.followUpDate } : {}),
    });
    if (args.followUpDate && isSupportedTimeZone("UTC")) {
      await new CustomerMomentRepository(supabase).create({
        retailerId: session.retailerId,
        customerId: asId<"CustomerId">(args.customerId),
        momentType: "follow_up",
        label: args.nextStep?.trim() || "Post-appointment follow-up",
        occursOn: args.followUpDate,
        recurrence: "none",
        timezone: "UTC",
        appointmentId: appointment.id,
        ...(appointment.branchId ? { branchId: appointment.branchId } : {}),
      });
    }
    if (appointment.status !== "completed") {
      await new AppointmentRepository(supabase).update(appointment.id, {
        status: "completed",
      });
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save closeout",
    };
  }

  revalidatePath(`/appointments/${args.appointmentId}`);
  revalidatePath(`/customers/${args.customerId}`);
  revalidatePath("/appointments");
  return { ok: true };
}
