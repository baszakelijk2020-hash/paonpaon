"use server";

import { requireRetailerRole } from "@paon/auth";
import { SupplierIntelligenceRepository } from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function splitKeys(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

export async function upsertButtonRule(formData: FormData): Promise<void> {
  const session = await requireModuleSession("garment_service_operations");
  requireRetailerRole(session.retailerRole, "manager");
  const fabricKey = String(formData.get("fabricKey") ?? "").trim();
  const note = String(formData.get("buttonNote") ?? "");
  const allowedButtonKeys = splitKeys(formData.get("allowedButtonKeys"));
  if (!fabricKey || allowedButtonKeys.length === 0) return;

  await new SupplierIntelligenceRepository(
    await getSupabaseServerClient(),
  ).upsertFabricButtonRule({
    retailerId: session.retailerId,
    fabricKey,
    allowedButtonKeys,
    note,
  });
  revalidatePath("/fabric-pairing");
}

export async function upsertLiningRule(formData: FormData): Promise<void> {
  const session = await requireModuleSession("garment_service_operations");
  requireRetailerRole(session.retailerRole, "manager");
  const fabricKey = String(formData.get("fabricKey") ?? "").trim();
  const note = String(formData.get("liningNote") ?? "");
  const standardLiningKeys = splitKeys(formData.get("standardLiningKeys"));
  const upsellLiningKeys = splitKeys(formData.get("upsellLiningKeys"));
  if (!fabricKey || standardLiningKeys.length === 0) return;

  await new SupplierIntelligenceRepository(
    await getSupabaseServerClient(),
  ).upsertFabricLiningRule({
    retailerId: session.retailerId,
    fabricKey,
    standardLiningKeys,
    upsellLiningKeys,
    note,
  });
  revalidatePath("/fabric-pairing");
}
