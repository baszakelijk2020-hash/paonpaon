"use server";

import {
  AppointmentRepository,
  CustomerRepository,
  WardrobeRepository,
  WardrobeRoadmapRepository,
} from "@paon/database";
import { asId, type AppointmentType } from "@paon/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { APPOINTMENT_REASONS } from "./booking-reasons";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface BookAppointmentState {
  fieldErrors: Record<string, string>;
  formError?: string;
  success?: boolean;
  appointmentId?: string;
}

const REASON_TO_TYPE: Record<string, AppointmentType> = {
  in_the_mood_for_something_fresh: "personal_shopping",
  a_quick_glance: "styling_consultation",
  service_repair: "alteration_fitting",
  service_size_check: "fitting",
};

const bookAppointmentSchema = z.object({
  retailerId: z.string().uuid(),
  reason: z.enum([
    "in_the_mood_for_something_fresh",
    "a_quick_glance",
    "service_repair",
    "service_size_check",
  ]),
  branchId: z.string().uuid().optional(),
  startsAt: z.string().datetime(),
  // Optional Wardrobe-originated context (DeepSeek remediation Cards 1-2):
  // re-resolved and re-authorized here independently of the client-supplied
  // `purpose` shown in the review step — never trust it for what gets
  // persisted. Neither ever blocks a booking: if the reference no longer
  // resolves to this customer's own data, it is silently dropped and the
  // appointment still books exactly like a plain, unprefixed booking.
  wardrobeItemId: z.string().uuid().optional(),
  roadmapGapId: z.string().uuid().optional(),
});

/** Real garment/gap context, re-verified against this session's own
 * customer — never the client-supplied `purpose` string. Returns `null`
 * (fail closed, no note suffix) for anything unresolved or cross-tenant. */
async function resolveBookingContextLabel(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  customerId: string,
  input: { wardrobeItemId?: string; roadmapGapId?: string },
): Promise<string | null> {
  if (input.wardrobeItemId) {
    const item = await new WardrobeRepository(supabase).findById(
      asId<"WardrobeItemId">(input.wardrobeItemId),
    );
    if (item && item.customerId === customerId && !item.retiredAt) {
      return item.displayName;
    }
    return null;
  }
  if (input.roadmapGapId) {
    const roadmaps = await new WardrobeRoadmapRepository(
      supabase,
    ).findByCustomer(asId<"CustomerId">(customerId), {
      customerVisibleOnly: true,
    });
    const gap = roadmaps
      .flatMap((roadmap) => roadmap.gaps)
      .find((candidate) => candidate.id === input.roadmapGapId);
    return gap?.title ?? null;
  }
  return null;
}

/**
 * My Appointments' new step-by-step booking flow (contract §6): reason,
 * real branch, real date/time all collapse into one real
 * `request_appointment` call — the same tenant-safe RPC every other
 * customer-initiated appointment already uses, now branch-aware.
 */
export async function bookAppointment(
  _prevState: BookAppointmentState,
  formData: FormData,
): Promise<BookAppointmentState> {
  const session = await requireSession();
  const parsed = bookAppointmentSchema.safeParse({
    retailerId: formData.get("retailerId"),
    reason: formData.get("reason"),
    branchId: formData.get("branchId") || undefined,
    startsAt: formData.get("startsAt"),
    wardrobeItemId: formData.get("wardrobeItemId") || undefined,
    roadmapGapId: formData.get("roadmapGapId") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "form"] ??= issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = customers.find(
    (candidate) => candidate.retailerId === parsed.data.retailerId,
  );
  if (!customer) {
    return {
      fieldErrors: {},
      formError: "No relationship with this retailer.",
    };
  }

  const startsAt = parsed.data.startsAt;
  const endsAt = new Date(
    new Date(startsAt).getTime() + 60 * 60_000,
  ).toISOString();
  const reasonLabel = APPOINTMENT_REASONS.find(
    (r) => r.value === parsed.data.reason,
  )?.label;
  const contextLabel = await resolveBookingContextLabel(supabase, customer.id, {
    ...(parsed.data.wardrobeItemId
      ? { wardrobeItemId: parsed.data.wardrobeItemId }
      : {}),
    ...(parsed.data.roadmapGapId
      ? { roadmapGapId: parsed.data.roadmapGapId }
      : {}),
  });
  const notes = [reasonLabel, contextLabel].filter(Boolean).join(" — ");

  let appointmentId: string;
  try {
    appointmentId = await new AppointmentRepository(
      supabase,
    ).requestAppointment({
      retailerId: asId<"RetailerId">(parsed.data.retailerId),
      type: REASON_TO_TYPE[parsed.data.reason]!,
      startsAt,
      endsAt,
      ...(notes ? { notes } : {}),
      ...(parsed.data.branchId
        ? { branchId: asId<"RetailerBranchId">(parsed.data.branchId) }
        : {}),
    });
  } catch (error) {
    return {
      fieldErrors: {},
      formError:
        error instanceof Error ? error.message : "Could not book appointment.",
    };
  }

  revalidatePath("/appointments");
  return { fieldErrors: {}, success: true, appointmentId };
}
