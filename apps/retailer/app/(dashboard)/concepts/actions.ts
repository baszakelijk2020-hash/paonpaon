"use server";

import { requireRetailerRole } from "@paon/auth";
import { ConceptScanRepository, RetailerStaffRepository } from "@paon/database";
import { issueConceptScanCodeInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function issueConceptScanCode(formData: FormData) {
  const session = await requireModuleSession("wardrobe_styling");
  requireRetailerRole(session.retailerRole, "manager");

  const expiresAtRaw = formData.get("expiresAt");
  const value = issueConceptScanCodeInputSchema.parse({
    productVariantId: formData.get("productVariantId"),
    kind: formData.get("kind"),
    ...(expiresAtRaw
      ? { expiresAt: new Date(String(expiresAtRaw)).toISOString() }
      : {}),
  });

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) throw new Error("Staff record not found");

  await new ConceptScanRepository(supabase).issueCode(
    session.retailerId,
    staff.id,
    {
      productVariantId: value.productVariantId as never,
      kind: value.kind,
      ...(value.expiresAt ? { expiresAt: value.expiresAt } : {}),
    },
  );

  revalidatePath("/concepts");
}

export async function rotateConceptScanCode(formData: FormData) {
  const session = await requireModuleSession("wardrobe_styling");
  requireRetailerRole(session.retailerRole, "manager");

  const codeId = String(formData.get("codeId"));
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) throw new Error("Staff record not found");

  await new ConceptScanRepository(supabase).rotateCode(
    codeId as never,
    staff.id,
  );

  revalidatePath("/concepts");
}

export async function recallConceptScanCode(formData: FormData) {
  const session = await requireModuleSession("wardrobe_styling");
  requireRetailerRole(session.retailerRole, "manager");

  const codeId = String(formData.get("codeId"));
  await new ConceptScanRepository(await getSupabaseServerClient()).recallCode(
    codeId as never,
  );

  revalidatePath("/concepts");
}
