import {
  CustomerPreferencesRepository,
  CustomerFactRepository,
  CustomerRepository,
  MetadataRepository,
  RetailerRepository,
  StylePortraitConsentRepository,
  StylePortraitRepository,
  StyleProfileRepository,
  WardrobeVisualizationJobRepository,
} from "@paon/database";
import { buildFitArchetypeOptions, type MetadataConceptId } from "@paon/domain";

import { CustomerFactsPanel } from "./customer-facts-panel";
import { PreferencesForm } from "./preferences-form";
import { StylePortraitPanel } from "./style-portrait-panel";
import { StyleProfilePanel } from "./style-profile-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AccountPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const preferencesRepo = new CustomerPreferencesRepository(supabase);
  const styleProfileRepo = new StyleProfileRepository(supabase);
  const metadataRepo = new MetadataRepository(supabase);
  const consentRepo = new StylePortraitConsentRepository(supabase);
  const portraitRepo = new StylePortraitRepository(supabase);
  const visualizationRepo = new WardrobeVisualizationJobRepository(supabase);
  const customerFactRepo = new CustomerFactRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const preferences = await preferencesRepo.findByCustomer(customer.id);
      const styleProfile = await styleProfileRepo.findByCustomer(
        customer.retailerId,
        customer.id,
      );
      const consent = await consentRepo.findForCustomer(
        customer.retailerId,
        customer.id,
      );
      const portrait = await portraitRepo.findLatestForCustomer(customer.id);
      const portraitPreviewJob = portrait
        ? await visualizationRepo.findLatestStylePortraitPreview(portrait.id)
        : null;
      const fitConcepts = await metadataRepo.findVisibleConcepts(
        customer.retailerId,
        "fit",
      );
      const fitArchetypes = buildFitArchetypeOptions(fitConcepts);
      const customerFacts = (
        await customerFactRepo.listForCustomer(customer.retailerId, customer.id)
      ).filter(
        (fact) =>
          fact.sensitivity === "standard" &&
          fact.provenanceClass !== "transactional" &&
          (fact.visibility === "customer_and_advisor" ||
            fact.visibility === "customer_only"),
      );

      const conceptIds = new Set<string>();
      for (const row of styleProfile?.explicitPreferences ?? []) {
        conceptIds.add(row.conceptId);
      }
      for (const row of styleProfile?.inferredPreferences ?? []) {
        conceptIds.add(row.conceptId);
      }

      const conceptLabels: Record<string, string> = {};
      await Promise.all(
        [...conceptIds].map(async (conceptId) => {
          const concept = await metadataRepo.findConceptById(
            customer.retailerId,
            conceptId as MetadataConceptId,
          );
          if (concept) {
            conceptLabels[conceptId] = concept.canonicalName;
          }
        }),
      );

      return {
        customer,
        retailer,
        preferences,
        styleProfile,
        conceptLabels,
        consent,
        portrait,
        portraitPreviewJob,
        fitArchetypes,
        customerFacts,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Settings
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Language, currency, contact and style preferences with each retailer
          you shop with.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No house connections yet.
          </p>
        </div>
      ) : (
        groups.map(
          ({
            customer,
            retailer,
            preferences,
            styleProfile,
            conceptLabels,
            consent,
            portrait,
            portraitPreviewJob,
            fitArchetypes,
            customerFacts,
          }) => (
            <div key={customer.id} className="flex flex-col gap-4">
              <PreferencesForm
                retailerId={customer.retailerId}
                retailerName={retailer?.displayName ?? "Retailer"}
                preferences={preferences}
              />
              <CustomerFactsPanel
                retailerName={retailer?.displayName ?? "Retailer"}
                facts={customerFacts}
              />
              <StyleProfilePanel
                retailerId={customer.retailerId}
                retailerName={retailer?.displayName ?? "Retailer"}
                profile={styleProfile}
                conceptLabels={conceptLabels}
              />
              <StylePortraitPanel
                retailerId={customer.retailerId}
                retailerName={retailer?.displayName ?? "Retailer"}
                consent={consent}
                portrait={portrait}
                previewJob={portraitPreviewJob}
                fitArchetypes={fitArchetypes}
              />
            </div>
          ),
        )
      )}
    </div>
  );
}
