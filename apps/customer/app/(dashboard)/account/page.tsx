import {
  CustomerPreferencesRepository,
  CustomerRepository,
  RetailerRepository,
} from "@paon/database";

import { PreferencesForm } from "./preferences-form";

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

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const preferences = await preferencesRepo.findByCustomer(customer.id);
      return { customer, retailer, preferences };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Account
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Language, currency, contact and style preferences with each retailer
          you shop with.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No retailer relationships yet.
          </p>
        </div>
      ) : (
        groups.map(({ customer, retailer, preferences }) => (
          <PreferencesForm
            key={customer.id}
            retailerId={customer.retailerId}
            retailerName={retailer?.displayName ?? "Retailer"}
            preferences={preferences}
          />
        ))
      )}
    </div>
  );
}
