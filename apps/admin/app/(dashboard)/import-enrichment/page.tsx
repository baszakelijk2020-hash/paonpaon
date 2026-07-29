import { requirePlatformOperator } from "@paon/auth";
import { ImportEnrichmentPromptRepository } from "@paon/database";
import {
  DEFAULT_IMPORT_ENRICHMENT_PROMPT_MARKDOWN,
  IMPORT_ENRICHMENT_PROMPT_SLUG,
} from "@paon/domain";
import { redirect } from "next/navigation";

import { ImportEnrichmentPromptForm } from "./prompt-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ImportEnrichmentPage() {
  const session = await requireSession();
  try {
    requirePlatformOperator(session);
  } catch {
    redirect("/ai-monitoring");
  }

  const prompt = await new ImportEnrichmentPromptRepository(
    await getSupabaseServerClient(),
  ).findBySlug(IMPORT_ENRICHMENT_PROMPT_SLUG);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
          Intelligence authority
        </p>
        <h1 className="font-display mt-2 text-4xl text-[var(--color-stone-900)]">
          Import enrichment
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
          Maintain the external PAON LLM contract used for AI-assisted catalogue
          import enrichment. Provider runners consume this prompt and never
          auto-accept inferences.
        </p>
      </div>

      <ImportEnrichmentPromptForm
        defaultValues={{
          slug: prompt?.slug ?? IMPORT_ENRICHMENT_PROMPT_SLUG,
          title: prompt?.title ?? "Catalogue import enrichment",
          promptMarkdown:
            prompt?.promptMarkdown ?? DEFAULT_IMPORT_ENRICHMENT_PROMPT_MARKDOWN,
          responseSchemaVersion: prompt?.responseSchemaVersion ?? "v1",
          active: prompt?.active ?? true,
        }}
      />
    </div>
  );
}
