"use server";

import {
  CustomerRepository,
  MeasurementMonitorRepository,
} from "@paon/database";
import type { MeasurementValue } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface MeasurementCaptureState {
  formError?: string;
  success?: boolean;
  decision?: "no_action" | "advisor_review" | "remeasure";
  message?: string;
}

/**
 * Record a guided self-measurement. The customer enters measurements in
 * centimetres; this action converts to millimetres, validates, and records
 * via recordCandidate with synthetic always-passing quality signals (no
 * photo/AI assessment for manual entry).
 */
export async function recordGuidedMeasurement(
  _previous: MeasurementCaptureState,
  formData: FormData,
): Promise<MeasurementCaptureState> {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  // Get the customer record for this user.
  const customerRepo = new CustomerRepository(supabase);
  const customers = await customerRepo.findByUserId(session.userId);
  if (customers.length === 0) {
    return { formError: "Customer record not found." };
  }
  const customer = customers[0]!;

  // Parse measurement entries from form. Each key like "chest", "waist", etc.
  // has a value in centimetres.
  const measurementMap = new Map<string, string>();
  const keys = [
    "chest",
    "waist",
    "sleeve_length",
    "shoulder",
    "jacket_length",
    "trouser_length",
    "trouser_inseam",
    "hips",
  ];

  for (const key of keys) {
    const cmValue = String(formData.get(key) ?? "").trim();
    if (cmValue) {
      measurementMap.set(key, cmValue);
    }
  }

  // Validate all 8 required fields are present.
  if (measurementMap.size !== keys.length) {
    return {
      formError: "All 8 measurements are required. Please fill in every field.",
    };
  }

  // Convert centimetres to whole millimetres.
  const values: MeasurementValue[] = [];
  for (const key of keys) {
    const cmValue = measurementMap.get(key)!;
    const cm = Number(cmValue);

    if (!Number.isFinite(cm) || cm <= 0) {
      return {
        formError: `Invalid measurement for ${key}. Enter a positive number.`,
      };
    }

    // Convert to mm. Round to nearest mm since customer input is in 0.1 cm.
    const mm = cm * 10;
    const roundedMm = Math.round(mm);

    // Ensure the rounded value is still a valid integer.
    if (!Number.isInteger(roundedMm)) {
      return {
        formError: `Measurement for ${key} is not a valid whole millimetre.`,
      };
    }

    values.push({
      key,
      millimetres: roundedMm,
      // Manual entry is "guided_self_scan" — the customer was walked through
      // a structured capture process, which is what "guided" means here. This
      // ensures the existing required-review-note-on-approval safety rule
      // engages for self-reported data.
      capturedBy: "guided_self_scan",
    });
  }

  try {
    const repo = new MeasurementMonitorRepository(supabase);

    // Synthetic quality signals: no photo assessment for manual entry.
    // These always pass the quality gate (poseConfidence 1.0, all landmarks
    // detected, scale reference present, enough captures). This is fine
    // because manual entry is not claimed to be photo-equivalent accuracy;
    // the point is that a customer was walked through a structured capture
    // and the result gets review-gated.
    const result = await repo.recordCandidate({
      retailerId: customer.retailerId,
      customerId: customer.id,
      values,
      qualitySignals: {
        captureCount: 1,
        poseConfidence: 1,
        landmarksDetected: 1,
        landmarksExpected: 1,
        hasScaleReference: true,
      },
      // No selfScanId: manual entry has no underlying wardrobe_self_scans row.
    });

    revalidatePath("/measurements");

    // Format the decision outcome in plain language.
    let message = "";
    switch (result.result.decision) {
      case "no_action":
        message = "Your measurements match what's on file. No changes needed.";
        break;
      case "advisor_review":
        message =
          "Thanks — an advisor will review this before it's used for any new garment.";
        break;
      case "remeasure":
        message =
          "Please try capturing your measurements again. Something didn't look quite right.";
        break;
    }

    return {
      success: true,
      decision: result.result.decision,
      message,
    };
  } catch (error) {
    console.error("Error recording measurement:", error);
    return {
      formError:
        "Something went wrong recording your measurements. Please try again.",
    };
  }
}
