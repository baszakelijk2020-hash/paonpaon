import { requirePlatformOperator } from "@paon/auth";
import { MetadataRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { redirect } from "next/navigation";

import {
  CanonicalConceptEditor,
  CreateCanonicalConceptForm,
} from "./canonical-concept-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function MetadataPage() {
  const session = await requireSession();
  try {
    requirePlatformOperator(session);
  } catch {
    redirect("/ai-monitoring");
  }

  const concepts = await new MetadataRepository(
    await getSupabaseServerClient(),
  ).findCanonicalConcepts();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
          Intelligence authority
        </p>
        <h1 className="font-display mt-2 text-4xl text-[var(--color-stone-900)]">
          Canonical metadata
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
          Govern PAON&apos;s reusable menswear vocabulary. Retailers can
          reference these concepts and override local presentation, but never
          mutate this source.
        </p>
      </div>

      <CreateCanonicalConceptForm />

      <section aria-labelledby="canonical-concepts-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2
              id="canonical-concepts-heading"
              className="font-display text-3xl text-[var(--color-stone-900)]"
            >
              Canonical concepts
            </h2>
            <p className="text-sm text-[var(--color-stone-500)]">
              {concepts.length} concept{concepts.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {concepts.length === 0 ? (
          <Card className="border-dashed py-14 text-center">
            <p className="font-display text-2xl">No canonical concepts yet.</p>
            <p className="mt-2 text-sm text-[var(--color-stone-500)]">
              Add only reviewed vocabulary that should be reusable across the
              platform.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {concepts.map((concept) => (
              <CanonicalConceptEditor key={concept.id} concept={concept} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
