"use server";

import { requireRetailerRole } from "@paon/auth";
import { SourceAuthorityRepository } from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ConnectionsActionState {
  readonly ok?: boolean;
  readonly message?: string;
  readonly deepLinkUrl?: string;
  readonly reconciliationState?: string;
}

export async function runFadenFixtureIngest(
  _prev: ConnectionsActionState,
): Promise<ConnectionsActionState> {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    return { message: "Manager access is required to exercise fixtures." };
  }

  const supabase = await getSupabaseServerClient();
  const repository = new SourceAuthorityRepository(supabase);

  try {
    const outcome = await repository.runFadenFixtureIngest(session.retailerId);
    revalidatePath("/settings/connections");

    const conflict = outcome.result.conflictReason
      ? ` Conflict: ${outcome.result.conflictReason}`
      : "";

    return {
      ok: outcome.result.reconciliationState !== "conflict",
      message: `Faden fixture ingest ${outcome.result.reconciliationState}.${conflict}`,
      deepLinkUrl: outcome.deepLinkUrl,
      reconciliationState: outcome.result.reconciliationState,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fixture ingest failed.";
    return { message };
  }
}
