"use server";

import {
  AnalyticsRepository,
  AppointmentRepository,
  CustomerConsentRepository,
  CustomerRepository,
} from "@paon/database";
import {
  asId,
  mayCapturePersonalizationForCustomer,
  requestAppointmentInputSchema,
  retentionExpiresAt,
} from "@paon/domain";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface RequestAppointmentFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
}

/**
 * `datetime-local` has no timezone offset — interpreted as UTC here,
 * the same deliberate simplification `computeAvailableSlots`
 * (@paon/domain) documents.
 */
function toIsoUtc(datetimeLocalValue: string): string | null {
  const date = new Date(`${datetimeLocalValue}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function requestAppointment(
  slug: string,
  retailerId: string,
  _prevState: RequestAppointmentFormState,
  formData: FormData,
): Promise<RequestAppointmentFormState> {
  const session = await getSession();
  if (!session || session.accountType !== "customer") {
    redirect(
      `/login?redirectTo=${encodeURIComponent(`/r/${slug}/appointments`)}`,
    );
  }

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const startsAt = toIsoUtc(raw["startsAt"] ?? "");
  // A consultation defaults to one hour — there is no duration picker in
  // this foundation; staff can adjust the confirmed time from Retailer
  // Portal if needed.
  const endsAt = startsAt
    ? new Date(new Date(startsAt).getTime() + 60 * 60_000).toISOString()
    : null;

  const parsed = requestAppointmentInputSchema.safeParse({
    retailerId,
    type: raw["type"],
    startsAt: startsAt ?? raw["startsAt"],
    endsAt: endsAt ?? raw["startsAt"],
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

  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(parsed.data.retailerId);

  let appointmentId: string;
  try {
    appointmentId = await new AppointmentRepository(
      supabase,
    ).requestAppointment({
      retailerId: rId,
      type: parsed.data.type,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { values: raw, fieldErrors: {}, formError: message };
  }

  try {
    const customers = await new CustomerRepository(supabase).findByUserId(
      session.userId,
    );
    const customer = customers.find((c) => c.retailerId === rId);
    if (customer) {
      const consentRepo = new CustomerConsentRepository(supabase);
      const consentState = await consentRepo.getState(rId, customer.id);
      if (mayCapturePersonalizationForCustomer(consentState)) {
        const occurredAt = new Date().toISOString();
        const consentSnapshot = await consentRepo.snapshotForCapture(
          rId,
          customer.id,
          occurredAt,
        );
        await new AnalyticsRepository(supabase).capture({
          retailerId: rId,
          customerId: customer.id,
          name: "appointment_intent",
          properties: {
            appointmentId,
            via: parsed.data.notes?.includes("TableService")
              ? "tableservice_conversion"
              : "storefront_appointments",
            type: parsed.data.type,
          },
          occurredAt,
          source: "customer_portal",
          purpose: "personalization",
          consentBasis: "explicit_opt_in",
          consentSnapshot,
          retentionClass: "personalization_signal",
          retentionExpiresAt: retentionExpiresAt({ occurredAt }),
        });
      }
    }
  } catch {
    // Best-effort conversion signal.
  }

  redirect(`/appointments/${appointmentId}`);
}
