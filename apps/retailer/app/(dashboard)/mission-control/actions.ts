"use server";

import { ClientelingOpportunityRepository } from "@paon/database";
import type { ClientelingOpportunityStatus } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function setOpportunityStatus(
  opportunityId: string,
  status: ClientelingOpportunityStatus,
): Promise<void> {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  await new ClientelingOpportunityRepository(supabase).setStatus({
    retailerId: session.retailerId,
    opportunityId,
    status,
  });
  revalidatePath("/mission-control");
}

export async function acceptOpportunity(opportunityId: string): Promise<void> {
  await setOpportunityStatus(opportunityId, "accepted");
}

export async function snoozeOpportunity(opportunityId: string): Promise<void> {
  await setOpportunityStatus(opportunityId, "snoozed");
}

export async function dismissOpportunity(opportunityId: string): Promise<void> {
  await setOpportunityStatus(opportunityId, "dismissed");
}
