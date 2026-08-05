"use server";

import { ConceptScanRepository } from "@paon/database";
import { resolveConceptScanCodeInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertRetailerModuleActive } from "@/lib/module-session";
import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ManualCodeEntryState {
  formError?: string;
}

/** The always-present manual-entry path (the blueprint requires this,
 * not just as a camera fallback) — resolves purely by navigating to the
 * same reveal route a scanned QR would also land on, so both paths share
 * one implementation. */
export async function resolveManualConceptCode(
  slug: string,
  _prev: ManualCodeEntryState,
  formData: FormData,
): Promise<ManualCodeEntryState> {
  const parsed = resolveConceptScanCodeInputSchema.safeParse({
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { formError: "Enter the code from your Try-On or swatch tag." };
  }
  redirect(`/r/${slug}/concepts/${encodeURIComponent(parsed.data.code)}`);
}

export interface AddConceptSelectionState {
  formError?: string;
  success?: boolean;
}

export async function addConceptScanSelection(
  slug: string,
  retailerId: string,
  code: string,
  _prev: AddConceptSelectionState,
): Promise<AddConceptSelectionState> {
  const session = await getSession();
  if (!session || session.accountType !== "customer") {
    redirect(
      `/login?redirectTo=${encodeURIComponent(`/r/${slug}/concepts/${code}`)}`,
    );
  }

  const supabase = await getSupabaseServerClient();
  try {
    await assertRetailerModuleActive(
      supabase,
      retailerId as never,
      "wardrobe_styling",
    );
    await new ConceptScanRepository(supabase).addToSelection(
      retailerId as never,
      code,
    );
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Could not add this piece.",
    };
  }

  revalidatePath(`/r/${slug}/concepts`);
  return { success: true };
}

export async function submitConceptSelection(formData: FormData) {
  const session = await getSession();
  if (!session || session.accountType !== "customer") {
    redirect("/login");
  }

  const slug = String(formData.get("slug"));
  const selectionId = String(formData.get("selectionId"));
  await new ConceptScanRepository(
    await getSupabaseServerClient(),
  ).submitSelection(selectionId as never);

  revalidatePath(`/r/${slug}/concepts`);
  redirect(`/r/${slug}/concepts?sent=1`);
}
