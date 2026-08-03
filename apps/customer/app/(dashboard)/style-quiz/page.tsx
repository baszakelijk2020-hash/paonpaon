import {
  CustomerRepository,
  MetadataRepository,
  RetailerRepository,
  StyleProfileRepository,
} from "@paon/database";
import {
  buildStyleQuizArchetypes,
  buildStyleQuizTweakQuestions,
} from "@paon/domain";

import { StyleQuizFlow } from "./style-quiz-flow";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function StyleQuizPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const metadataRepo = new MetadataRepository(supabase);
  const styleProfileRepo = new StyleProfileRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const [
        styleConcepts,
        fitConcepts,
        patternConcepts,
        colourConcepts,
        formalityConcepts,
      ] = await Promise.all([
        metadataRepo.findVisibleConcepts(customer.retailerId, "style"),
        metadataRepo.findVisibleConcepts(customer.retailerId, "fit"),
        metadataRepo.findVisibleConcepts(customer.retailerId, "pattern"),
        metadataRepo.findVisibleConcepts(customer.retailerId, "colour"),
        metadataRepo.findVisibleConcepts(customer.retailerId, "formality"),
      ]);
      const archetypes = buildStyleQuizArchetypes(styleConcepts);
      const tweakQuestions = buildStyleQuizTweakQuestions([
        ...fitConcepts,
        ...patternConcepts,
        ...colourConcepts,
        ...formalityConcepts,
      ]);
      const profile = await styleProfileRepo.findByCustomer(
        customer.retailerId,
        customer.id,
      );
      const declaredConceptIds = (profile?.explicitPreferences ?? []).map(
        (row) => row.conceptId as string,
      );

      return {
        customer,
        retailer,
        archetypes,
        tweakQuestions,
        declaredConceptIds,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Style quiz
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Sixty seconds, no typing — tap the wardrobe that feels most like you,
          then a few quick tweaks. Every tap updates your real style profile in
          Settings.
        </p>
      </div>

      {groups.length === 0 ? (
        <div
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center"
          role="status"
        >
          <p className="text-[var(--color-stone-600)]">
            No house connections yet.
          </p>
        </div>
      ) : (
        groups.map(
          ({
            customer,
            retailer,
            archetypes,
            tweakQuestions,
            declaredConceptIds,
          }) => (
            <StyleQuizFlow
              key={customer.id}
              retailerId={customer.retailerId}
              retailerName={retailer?.displayName ?? "Retailer"}
              archetypes={archetypes}
              tweakQuestions={tweakQuestions}
              declaredConceptIds={declaredConceptIds}
            />
          ),
        )
      )}
    </div>
  );
}
