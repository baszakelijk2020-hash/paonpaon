"use server";

import { ClientelingOpportunityRepository } from "@paon/database";
import {
  CLIENTELING_OPPORTUNITY_STATUSES,
  type ClientelingOpportunityStatus,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function parseStatus(
  value: FormDataEntryValue | null,
): ClientelingOpportunityStatus | null {
  if (typeof value !== "string") return null;
  return (CLIENTELING_OPPORTUNITY_STATUSES as readonly string[]).includes(value)
    ? (value as ClientelingOpportunityStatus)
    : null;
}

export async function setClientelingOpportunityStatus(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const opportunityId = formData.get("opportunityId");
  const customerId = formData.get("customerId");
  const status = parseStatus(formData.get("status"));
  if (
    typeof opportunityId !== "string" ||
    typeof customerId !== "string" ||
    !status
  ) {
    return;
  }

  const supabase = await getSupabaseServerClient();
  await new ClientelingOpportunityRepository(supabase).setStatus({
    retailerId: session.retailerId,
    opportunityId,
    status,
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/dashboard");
}
