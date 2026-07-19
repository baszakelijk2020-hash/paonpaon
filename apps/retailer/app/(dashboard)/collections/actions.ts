"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  CollectionRepository,
  CollectionSlugAlreadyExistsError,
} from "@paon/database";
import { createCollectionInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CreateCollectionFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
}

export async function createCollection(
  _prevState: CreateCollectionFormState,
  formData: FormData,
): Promise<CreateCollectionFormState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const parsed = createCollectionInputSchema.safeParse({
    name: raw["name"],
    slug: raw["slug"],
    season: raw["season"] || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { values: raw, fieldErrors };
  }

  const supabase = await getSupabaseServerClient();

  try {
    await new CollectionRepository(supabase).create({
      retailerId: session.retailerId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      ...(parsed.data.season ? { season: parsed.data.season } : {}),
    });
  } catch (error) {
    if (error instanceof CollectionSlugAlreadyExistsError) {
      return { values: raw, fieldErrors: { slug: error.message } };
    }
    throw error;
  }

  revalidatePath("/collections");
  return { values: {}, fieldErrors: {} };
}
