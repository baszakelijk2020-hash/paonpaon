"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  MeasurementMonitorRepository,
  RetailerStaffRepository,
} from "@paon/database";
import type { MeasurementValue } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface MeasurementActionState {
  formError?: string;
  notice?: string;
}

const REJECTION_MESSAGES: Record<string, string> = {
  review_note_required:
    "A review note is required when any value came from a guided self-scan. Explain your decision in writing.",
  non_integer_millimetres:
    "All measurements must be whole millimetres — no decimals.",
  no_values: "At least one measurement must be provided.",
  version_not_incremented: "The version could not be incremented.",
  duplicate_measurement_key:
    "Each measurement key can only appear once. Check for duplicates.",
  self_scan_cannot_self_approve:
    "A staff member cannot approve their own measurements.",
};

/**
 * Record approved measurements for a candidate. The advisor restates the
 * values they actually signed off (which may differ from the candidate),
 * and when any value came from a self-scan, a written review note is
 * required by the domain.
 */
export async function recordApprovedMeasurements(
  _previous: MeasurementActionState,
  formData: FormData,
): Promise<MeasurementActionState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");

  const supabase = await getSupabaseServerClient();
  const staffRepo = new RetailerStaffRepository(supabase);
  const advisor = await staffRepo.findByUserId(session.userId);
  if (!advisor) {
    return { formError: "Your staff record could not be found." };
  }

  const candidateId = String(formData.get("candidateId") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const reviewNote = String(formData.get("reviewNote") ?? "").trim();

  if (!candidateId || !customerId) {
    return { formError: "Missing required information." };
  }

  // Parse measurement entries. Each entry has key-millimetres pairs.
  // The form sends them as "measurement_<index>_key" and "measurement_<index>_mm".
  const measurementMap = new Map<string, string>();

  for (const [key, value] of formData) {
    if (key.startsWith("measurement_") && key.endsWith("_mm")) {
      const indexMatch = key.match(/^measurement_(\d+)_mm$/);
      if (indexMatch) {
        const index = indexMatch[1];
        const keyField = `measurement_${index}_key`;
        const mmValue = String(value).trim();
        const keyValue = formData.get(keyField);
        if (keyValue && mmValue) {
          measurementMap.set(String(keyValue), mmValue);
        }
      }
    }
  }

  if (measurementMap.size === 0) {
    return { formError: "At least one measurement must be provided." };
  }

  // Convert the form data into MeasurementValue entries.
  // The values come from the form as cm; convert back to millimetres.
  const values: MeasurementValue[] = [];
  for (const [key, cmValue] of measurementMap.entries()) {
    const cm = parseFloat(cmValue);
    if (isNaN(cm) || cm <= 0) {
      return {
        formError: `Invalid measurement for ${key}. Enter a positive decimal number in centimetres.`,
      };
    }
    const mm = Math.round(cm * 10);
    if (!Number.isInteger(mm) || mm <= 0) {
      return {
        formError: `Invalid measurement for ${key}. Ensure it converts to a positive whole millimetre.`,
      };
    }
    values.push({
      key,
      millimetres: mm,
      capturedBy: "tailor_tape",
    });
  }

  const repo = new MeasurementMonitorRepository(supabase);
  const result = await repo.recordApprovedVersion({
    retailerId: session.retailerId,
    customerId,
    values,
    approvedByStaffId: advisor.id,
    ...(reviewNote ? { reviewNote } : {}),
    reviewedCandidateId: candidateId,
  });

  if (!result.ok) {
    return {
      formError:
        REJECTION_MESSAGES[result.reason] ??
        "The measurements could not be recorded.",
    };
  }

  // Mark the candidate as resolved.
  await repo.resolveCandidate({
    retailerId: session.retailerId,
    candidateId,
    resolvedByStaffId: advisor.id,
  });

  revalidatePath("/staff/measurements");
  return { notice: "Measurements recorded and approved." };
}

/**
 * Dismiss a candidate without recording new approved measurements.
 * Only marks it as resolved; does not change the approval state.
 */
export async function dismissCandidate(
  _previous: MeasurementActionState,
  formData: FormData,
): Promise<MeasurementActionState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");

  const supabase = await getSupabaseServerClient();
  const staffRepo = new RetailerStaffRepository(supabase);
  const advisor = await staffRepo.findByUserId(session.userId);
  if (!advisor) {
    return { formError: "Your staff record could not be found." };
  }

  const candidateId = String(formData.get("candidateId") ?? "").trim();

  if (!candidateId) {
    return { formError: "Missing candidate ID." };
  }

  const repo = new MeasurementMonitorRepository(supabase);
  await repo.resolveCandidate({
    retailerId: session.retailerId,
    candidateId,
    resolvedByStaffId: advisor.id,
  });

  revalidatePath("/staff/measurements");
  return { notice: "Candidate dismissed without changes." };
}
