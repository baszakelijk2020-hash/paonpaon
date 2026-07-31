"use server";

import { requireRetailerRole } from "@paon/auth";
import { IntegrationLifecycleRepository } from "@paon/database";
import type { ConnectionOperationalState } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ConnectionLifecycleActionState {
  formError?: string;
}

/**
 * Operator-facing pause/resume/disconnect (PHASE 9.2). Legality of the
 * requested transition is decided by the domain layer via
 * `IntegrationLifecycleRepository.transitionConnection` — this action only
 * authorizes the caller and reports the outcome, never re-implements the
 * state machine.
 */
export async function transitionConnection(
  _previous: ConnectionLifecycleActionState,
  formData: FormData,
): Promise<ConnectionLifecycleActionState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "admin");

  const connectionId = String(formData.get("connectionId") ?? "");
  const requestedState = String(
    formData.get("requestedState") ?? "",
  ) as ConnectionOperationalState;
  const reason = formData.get("reason");

  if (
    !connectionId ||
    !["active", "paused", "disconnected"].includes(requestedState)
  ) {
    return { formError: "Invalid connection or requested state." };
  }

  const supabase = await getSupabaseServerClient();
  const repo = new IntegrationLifecycleRepository(supabase);
  const result = await repo.transitionConnection({
    retailerId: session.retailerId,
    connectionId,
    requestedState,
    ...(typeof reason === "string" && reason.trim()
      ? { reason: reason.trim() }
      : {}),
    // AppSession does not currently carry the retailer_staff_members row
    // id (only the auth.users id), so operational_state_changed_by is left
    // unset here — the column is nullable for exactly this reason. Wiring
    // real actor attribution is a follow-up, not a defect: nothing in 9.2's
    // acceptance requires it, and leaving it null is honest about what this
    // slice does not yet do.
  });

  if (!result.ok) {
    return {
      formError:
        result.reason === "already_in_state"
          ? "That connection is already in the requested state."
          : "That transition is not allowed from the connection's current state.",
    };
  }

  revalidatePath("/settings/integrations");
  return {};
}
