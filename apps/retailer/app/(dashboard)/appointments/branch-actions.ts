"use server";

import { RetailerBranchRepository } from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function ensureDefaultBranchAction(): Promise<void> {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    return;
  }
  const supabase = await getSupabaseServerClient();
  await new RetailerBranchRepository(supabase).ensureDefaultBranch({
    retailerId: session.retailerId,
    timezone: "Europe/Amsterdam",
  });
  revalidatePath("/appointments");
}
