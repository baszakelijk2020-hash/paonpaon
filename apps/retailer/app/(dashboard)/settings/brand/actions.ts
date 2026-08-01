"use server";

import { requireRetailerRole } from "@paon/auth";
import { RetailerRepository } from "@paon/database";
import { retailerBrandThemeSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface BrandThemeActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
}

export async function saveBrandTheme(
  _previous: BrandThemeActionState,
  formData: FormData,
): Promise<BrandThemeActionState> {
  const session = await requireModuleSession("platform_core");
  requireRetailerRole(session.retailerRole, "admin");
  const parsed = retailerBrandThemeSchema.safeParse({
    logoUrl: formData.get("logoUrl"),
    faviconUrl: formData.get("faviconUrl"),
    heroImageUrl: formData.get("heroImageUrl"),
    accentColor: formData.get("accentColor"),
    surfaceColor: formData.get("surfaceColor"),
    inkColor: formData.get("inkColor"),
    displayFont: formData.get("displayFont"),
    bodyFont: formData.get("bodyFont"),
    cornerStyle: formData.get("cornerStyle"),
  });
  if (!parsed.success) {
    return {
      error: "Review the theme tokens before publishing.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const changeNote = String(formData.get("changeNote") ?? "").trim();
  if (changeNote.length < 2 || changeNote.length > 240) {
    return {
      error: "Add a short change note so this version can be restored safely.",
      fieldErrors: { changeNote: ["Use between 2 and 240 characters."] },
    };
  }
  try {
    const version = await new RetailerRepository(
      await getSupabaseServerClient(),
    ).saveBrandTheme(session.retailerId, parsed.data, changeNote);
    revalidatePath("/", "layout");
    return { success: `Brand theme version ${version} is now live.` };
  } catch {
    return { error: "The brand theme could not be saved. Please try again." };
  }
}

export async function restoreBrandTheme(formData: FormData): Promise<void> {
  const session = await requireModuleSession("platform_core");
  requireRetailerRole(session.retailerRole, "admin");
  const version = Number(formData.get("versionNumber"));
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("Invalid theme version");
  }
  await new RetailerRepository(
    await getSupabaseServerClient(),
  ).restoreBrandTheme(session.retailerId, version);
  revalidatePath("/", "layout");
}
