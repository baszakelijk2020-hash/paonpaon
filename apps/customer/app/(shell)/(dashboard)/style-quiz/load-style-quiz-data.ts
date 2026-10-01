import {
  MetadataRepository,
  RetailerRepository,
  StyleProfileRepository,
  type PaonSupabaseClient,
} from "@paon/database";
import {
  buildStyleQuizArchetypes,
  buildStyleQuizTweakQuestions,
  type Customer,
  type Retailer,
  type StyleQuizArchetype,
  type StyleQuizTweakQuestion,
} from "@paon/domain";

export interface StyleQuizData {
  customer: Customer;
  retailer: Retailer | null;
  archetypes: readonly StyleQuizArchetype[];
  tweakQuestions: readonly StyleQuizTweakQuestion[];
  declaredConceptIds: string[];
}

export async function loadStyleQuizData(
  supabase: PaonSupabaseClient,
  customers: Customer[],
): Promise<StyleQuizData[]> {
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

  return groups;
}
