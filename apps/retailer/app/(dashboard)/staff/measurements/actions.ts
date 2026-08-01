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

  // The candidate is read from the database, never from the form.
  //
  // Provenance is the whole point of this gate, and the client must not get to
  // state it. Trusting a hidden field here would let anyone post
  // `capturedBy: tailor_tape` and walk a phone scan straight into the record
  // of measurement with no written decision at all.
  const { data: candidateRow, error: candidateError } = await supabase
    .from("customer_measurement_candidates")
    .select("values")
    .eq("id", candidateId)
    .eq("retailer_id", session.retailerId)
    .maybeSingle();
  if (candidateError) throw candidateError;
  if (!candidateRow) {
    return { formError: "That review could not be found." };
  }
  const proposedByKey = new Map(
    (candidateRow.values as unknown as readonly MeasurementValue[]).map(
      (value) => [value.key, value],
    ),
  );

  // Convert the form data into MeasurementValue entries. The form sends
  // centimetres; the record is whole millimetres.
  const values: MeasurementValue[] = [];
  for (const [key, cmValue] of measurementMap.entries()) {
    const cm = Number(cmValue);
    if (!Number.isFinite(cm) || cm <= 0) {
      return {
        formError: `Invalid measurement for ${key}. Enter a positive number in centimetres.`,
      };
    }
    // NOT rounded. Rounding 101.05 cm to 1011 mm silently invents a precision
    // the tape never had and quietly makes the "whole millimetres" rule
    // unreachable — the number a garment is cut to should be the number
    // somebody actually read off the tape.
    const mm = cm * 10;
    if (!Number.isInteger(mm)) {
      return {
        formError:
          "All measurements must be whole millimetres — no decimals. Enter centimetres to one decimal place.",
      };
    }

    const proposed = proposedByKey.get(key);
    // Unchanged means the advisor is ACCEPTING the scan's number, so the scan
    // is still where that number came from and the written-decision rule must
    // apply. Changed means they measured it themselves, which is a tape.
    const acceptedAsProposed =
      proposed !== undefined && proposed.millimetres === mm;
    values.push({
      key,
      millimetres: mm,
      capturedBy: acceptedAsProposed ? proposed.capturedBy : "tailor_tape",
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
