import { CustomerRepository, RetailerRepository } from "@paon/database";

import { MorningRoutinePanel } from "./morning-routine-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function MorningRoutinePage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      return { customer, retailer };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Morning routine
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          A considered start to the day — owned garments rank first, catalogue
          suggestions fill gaps, and every choice explains itself. Weather,
          occasion, and StyleProfile inputs are optional and consent-aware.
        </p>
      </div>

      {groups.length === 0 ? (
        <div
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center"
          role="status"
        >
          <p className="text-[var(--color-stone-600)]">
            Connect with a house to plan your morning routine.
          </p>
        </div>
      ) : (
        groups.map(({ customer, retailer }) =>
          retailer ? (
            <MorningRoutinePanel
              key={customer.id}
              retailerId={retailer.id}
              customerId={customer.id}
              slug={retailer.slug}
              retailerName={retailer.displayName}
            />
          ) : null,
        )
      )}
    </div>
  );
}
