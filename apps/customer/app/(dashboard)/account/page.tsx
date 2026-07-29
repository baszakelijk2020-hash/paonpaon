import {
  CustomerConsentRepository,
  CustomerPreferencesRepository,
  CustomerRepository,
  MetadataRepository,
  RetailerRepository,
  StyleProfileRepository,
} from "@paon/database";

import { PreferencesForm } from "./preferences-form";
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
  const consentRepo = new CustomerConsentRepository(supabase);
  const styleProfileRepo = new StyleProfileRepository(supabase);
  const metadataRepo = new MetadataRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const preferences = await preferencesRepo.findByCustomer(customer.id);
      const consent = await consentRepo.getState(
        customer.retailerId,
        customer.id,
      );
      const styleProfile =
        consent.personalization.status === "granted"
          ? await styleProfileRepo.findByCustomer(
              customer.retailerId,
              customer.id,
            )
          : null;

      const conceptIds = new Set<string>();
      for (const pref of styleProfile?.explicitPreferences ?? []) {
        conceptIds.add(String(pref.conceptId));
      }
      for (const pref of styleProfile?.inferredPreferences ?? []) {
        conceptIds.add(String(pref.conceptId));
      }

      const conceptNames: Record<string, string> = {};
      await Promise.all(
        [...conceptIds].map(async (conceptId) => {
          const concept = await metadataRepo.findConceptById(
            customer.retailerId,
            conceptId as never,
          );
          if (concept) {
            conceptNames[conceptId] = concept.canonicalName;
          }
        }),
      );

      return {
        customer,
        retailer,
        preferences,
        styleProfile,
        conceptNames,
        showStyleProfile: consent.personalization.status === "granted",
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
            conceptNames,
            showStyleProfile,
          }) => (
            <div key={customer.id} className="flex flex-col gap-4">
              <PreferencesForm
                retailerId={customer.retailerId}
                retailerName={retailer?.displayName ?? "Retailer"}
                preferences={preferences}
              />
              {showStyleProfile && styleProfile ? (
                <StyleProfilePanel
                  retailerId={customer.retailerId}
                  retailerName={retailer?.displayName ?? "Retailer"}
                  profile={styleProfile}
                  conceptNames={conceptNames}
                />
              ) : null}
            </div>
          ),
        )
      )}
    </div>
  );
}
