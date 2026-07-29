"use server";

import { requirePlatformOperator } from "@paon/auth";
import { ImportEnrichmentPromptRepository } from "@paon/database";
import {
  IMPORT_ENRICHMENT_PROMPT_SLUG,
  updateImportEnrichmentPromptInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ImportEnrichmentPromptFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
  saved?: boolean;
}

function fieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}

export async function updateImportEnrichmentPrompt(
  _previous: ImportEnrichmentPromptFormState,
  formData: FormData,
): Promise<ImportEnrichmentPromptFormState> {
  const session = await requireSession();
  requirePlatformOperator(session);
  const values = Object.fromEntries(formData.entries()) as Record<
    string,
    string
  >;

  const parsed = updateImportEnrichmentPromptInputSchema.safeParse({
    slug: values["slug"] || IMPORT_ENRICHMENT_PROMPT_SLUG,
    title: values["title"],
    promptMarkdown: values["promptMarkdown"],
    responseSchemaVersion: values["responseSchemaVersion"] || "v1",
    active: values["active"] !== "false",
  });
  if (!parsed.success) {
    return {
      values,
      fieldErrors: fieldErrors(parsed.error.issues),
    };
  }

  try {
    await new ImportEnrichmentPromptRepository(
      await getSupabaseServerClient(),
    ).upsert({
      ...parsed.data,
      updatedByUserId: session.userId,
    });
  } catch (error) {
    return {
      values,
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "The enrichment prompt could not be saved.",
    };
  }

  revalidatePath("/import-enrichment");
  return {
    values: {
      slug: parsed.data.slug,
      title: parsed.data.title,
      promptMarkdown: parsed.data.promptMarkdown,
      responseSchemaVersion: parsed.data.responseSchemaVersion,
      active: parsed.data.active ? "true" : "false",
    },
    fieldErrors: {},
    saved: true,
  };
}
