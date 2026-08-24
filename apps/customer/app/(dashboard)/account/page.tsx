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
    <div className="customer-page flex flex-col gap-8">
      <header className="customer-page-header flex-col">
        <p className="customer-kicker text-[var(--color-stone-500)]">
          Your house book
        </p>
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl leading-[1.05] tracking-[-0.03em] text-[var(--color-stone-900)] sm:text-5xl">
            Your preferences, kept close.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--color-stone-500)]">
            Language, currency, contact and style preferences with each house
            you shop with.
          </p>
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="customer-panel flex min-h-40 items-center px-6 py-10">
          <div>
            <p className="customer-kicker text-[var(--color-stone-500)]">
              House connections
            </p>
            <p className="mt-2 text-base text-[var(--color-stone-600)]">
              No house connections yet.
            </p>
          </div>
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
            <section key={customer.id} className="flex flex-col gap-5">
              <div className="flex items-end justify-between gap-4 border-b border-[var(--customer-border)] pb-3">
                <div>
                  <p className="customer-kicker text-[var(--color-stone-500)]">
                    Connected house
                  </p>
                  <h2 className="mt-1 text-2xl tracking-[-0.02em] text-[var(--color-stone-900)]">
                    {retailer?.displayName ?? "Retailer"}
                  </h2>
                </div>
                <span className="hidden rounded-[var(--customer-radius)] bg-[var(--customer-moss)] px-3 py-2 text-xs text-[var(--color-stone-700)] sm:inline-flex">
                  Private client
                </span>
              </div>
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
            </section>
          ),
        )
      )}
    </div>
  );
}
