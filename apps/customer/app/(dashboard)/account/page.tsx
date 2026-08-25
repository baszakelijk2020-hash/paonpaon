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
      return {
        customer,
        retailer,
        preferences,
      };
    }),
  );

  return (
    <div className="customer-page flex flex-col gap-8">
      <header className="customer-page-header flex-col">
        <p className="customer-kicker text-[var(--color-stone-500)]">
          My profile
        </p>
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl leading-[1.05] tracking-[-0.03em] text-[var(--color-stone-900)] sm:text-5xl">
            Your preferences, kept close.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--color-stone-500)]">
            Language, currency and contact preferences for your account.
          </p>
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="customer-panel flex min-h-40 items-center px-6 py-10">
          <div>
            <p className="customer-kicker text-[var(--color-stone-500)]">
              Your profile
            </p>
            <p className="mt-2 text-base text-[var(--color-stone-600)]">
              No profile details yet.
            </p>
          </div>
        </div>
      ) : (
        groups.map(({ customer, retailer, preferences }) => (
          <section key={customer.id} className="flex flex-col gap-5">
            <div className="flex items-end justify-between gap-4 border-b border-[var(--customer-border)] pb-3">
              <div>
                <p className="customer-kicker text-[var(--color-stone-500)]">
                  Your retailer
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
          </section>
        ))
      )}
    </div>
  );
}
