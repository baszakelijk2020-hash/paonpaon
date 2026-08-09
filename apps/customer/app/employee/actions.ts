"use server";

import { AppointmentRepository, CorporateRepository } from "@paon/database";
import {
  APPOINTMENT_TYPES,
  createCorporateExceptionInputSchema,
  type AppointmentType,
  type CorporateExceptionKind,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { WEARER_RAISABLE_EXCEPTION_KINDS } from "./service-request-kinds";

import { requireWearerAppSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface RaiseServiceRequestFormState {
  formError?: string;
  submitted: boolean;
}

export async function raiseServiceRequest(
  _previous: RaiseServiceRequestFormState,
  formData: FormData,
): Promise<RaiseServiceRequestFormState> {
  const session = await requireWearerAppSession();
  const supabase = await getSupabaseServerClient();
  const repo = new CorporateRepository(supabase);

  const wearer = await repo.findWearerById(session.wearerId);
  if (!wearer) {
    return {
      formError: "Your employee record could not be found.",
      submitted: false,
    };
  }

  const kind = String(formData.get("kind") ?? "");
  if (
    !WEARER_RAISABLE_EXCEPTION_KINDS.includes(kind as CorporateExceptionKind)
  ) {
    return { formError: "Choose what the problem is.", submitted: false };
  }

  const values = createCorporateExceptionInputSchema.parse({
    programmeId: wearer.programmeId,
    wearerId: wearer.id,
    kind,
    detail: formData.get("detail"),
  });
  await repo.createException(wearer.retailerId, values);
  revalidatePath("/employee");
  return { submitted: true };
}

export interface RequestAppointmentFormState {
  formError?: string;
  submitted: boolean;
}

/** PHASE 18.5 / BD-105 write-capable self-service: a linked wearer
 * requests a real appointment through `request_appointment_as_wearer`,
 * which only books through their EXISTING linked customer — never
 * fabricates one. An unlinked wearer gets the RPC's own clear refusal
 * reason surfaced directly, not a generic error. */
export async function requestAppointmentAsWearer(
  _previous: RequestAppointmentFormState,
  formData: FormData,
): Promise<RequestAppointmentFormState> {
  const session = await requireWearerAppSession();
  const supabase = await getSupabaseServerClient();
  const repo = new CorporateRepository(supabase);

  const wearer = await repo.findWearerById(session.wearerId);
  if (!wearer) {
    return {
      formError: "Your employee record could not be found.",
      submitted: false,
    };
  }

  const type = String(formData.get("type") ?? "");
  if (!APPOINTMENT_TYPES.includes(type as AppointmentType)) {
    return { formError: "Choose what you'd like to book.", submitted: false };
  }
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    return { formError: "Choose a preferred date and time.", submitted: false };
  }
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const notes = String(formData.get("notes") ?? "").trim();

  try {
    await new AppointmentRepository(supabase).requestAppointmentAsWearer({
      wearerId: wearer.id,
      type: type as AppointmentType,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      ...(notes ? { notes } : {}),
    });
  } catch (error) {
    return {
      formError:
        error instanceof Error
          ? error.message
          : "Could not request that appointment.",
      submitted: false,
    };
  }

  revalidatePath("/employee");
  return { submitted: true };
}
