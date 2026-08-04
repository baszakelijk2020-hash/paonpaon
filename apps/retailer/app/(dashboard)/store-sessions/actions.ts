"use server";

import {
  RetailerStaffRepository,
  StoreExperienceRepository,
} from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface StoreSessionActionState {
  formError?: string;
  notice?: string;
}

const REJECTION_MESSAGES: Record<string, string> = {
  reason_required:
    "Say why the customer preferred this — at least 5 characters. A preference with no reason is a sale, not something the next advisor can learn from.",
  no_preference_recorded: "Record which one the customer preferred.",
  device_failure_needs_manual_fallback:
    "The device failed. Confirm the session was finished on paper before closing it.",
  no_customer_approved_look: "Name the look the customer actually approved.",
  outcome_requires_advisor: "An advisor must be attached to close a session.",
};

async function context() {
  const session = await requireModuleSession(
    "garment_service_operations",
    "mutate",
  );
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) throw new Error("No staff record for this session.");
  return {
    session,
    staff,
    store: new StoreExperienceRepository(supabase),
  };
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function openSession(
  _previous: StoreSessionActionState,
  formData: FormData,
): Promise<StoreSessionActionState> {
  const { session, staff, store } = await context();
  const customerId = field(formData, "customerId");

  await store.openSession({
    retailerId: session.retailerId,
    advisorStaffId: staff.id,
    ...(customerId ? { customerId } : {}),
  });
  revalidatePath("/store-sessions");
  return { notice: "Session opened." };
}

export async function recordComparison(
  _previous: StoreSessionActionState,
  formData: FormData,
): Promise<StoreSessionActionState> {
  const { session, store } = await context();
  const sessionId = field(formData, "sessionId");
  const constructionKind = field(formData, "constructionKind") as
    "half_canvas" | "full_canvas" | "handmade";
  const customerPreferred = field(formData, "customerPreferred") === "true";
  const notedReason = field(formData, "notedReason");
  if (!sessionId || !constructionKind) {
    return { formError: "Choose what was compared." };
  }

  const result = await store.recordComparisonEntry({
    retailerId: session.retailerId,
    sessionId,
    constructionKind,
    customerPreferred,
    ...(notedReason ? { notedReason } : {}),
  });
  if (!result.ok) {
    return {
      formError:
        REJECTION_MESSAGES[result.reason] ?? "That could not be recorded.",
    };
  }
  revalidatePath("/store-sessions");
  return { notice: "Comparison recorded." };
}

export async function closeSession(
  _previous: StoreSessionActionState,
  formData: FormData,
): Promise<StoreSessionActionState> {
  const { session, staff, store } = await context();
  const sessionId = field(formData, "sessionId");
  const customerApprovedLookRef = field(formData, "customerApprovedLookRef");
  const deviceFailed = field(formData, "deviceFailed") === "true";
  const manualFallbackUsed = field(formData, "manualFallbackUsed") === "true";
  const outcomeNote = field(formData, "outcomeNote");
  if (!sessionId) return { formError: "Choose a session to close." };

  const result = await store.closeSession({
    retailerId: session.retailerId,
    sessionId,
    customerApprovedLookRef,
    advisorStaffId: staff.id,
    deviceFailed,
    manualFallbackUsed,
    ...(outcomeNote ? { outcomeNote } : {}),
  });
  if (!result.ok) {
    return {
      formError:
        REJECTION_MESSAGES[result.reason] ??
        "That session could not be closed.",
    };
  }
  revalidatePath("/store-sessions");
  return { notice: "Session closed." };
}
