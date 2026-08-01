"use server";

import { requireRetailerRole } from "@paon/auth";
import { MigrationJobRepository } from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function createFixtureMigrationJobAction(): Promise<void> {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "admin");
  await new MigrationJobRepository(getSupabaseAdminClient()).createFixtureJob({
    retailerId: session.retailerId,
  });
  revalidatePath("/migrations");
}

export async function publishMigrationJobAction(
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "admin");
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) throw new Error("Missing job id");
  await new MigrationJobRepository(getSupabaseAdminClient()).publishJob({
    retailerId: session.retailerId,
    jobId,
  });
  revalidatePath("/migrations");
  revalidatePath("/products");
  revalidatePath("/customers");
  revalidatePath("/orders");
}
