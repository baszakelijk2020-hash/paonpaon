import {
  CustomerRepository,
  RetailerRepository,
  WardrobeRepository,
} from "@paon/database";

import { WardrobeHousePanel } from "./wardrobe-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function WardrobePage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const wardrobeRepo = new WardrobeRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const items = await wardrobeRepo.findByCustomer(
        customer.retailerId,
        customer.id,
      );
      return { customer, retailer, items };
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Wardrobe
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          What you own with each house — retailer purchases and garments you
          added yourself. Your advisor can collaborate inside the same
          relationship.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          Connect with a retailer to start building your wardrobe.
        </p>
      ) : (
        groups.map(({ customer, retailer, items }) =>
          retailer ? (
            <WardrobeHousePanel
              key={customer.id}
              retailerId={retailer.id}
              retailerName={retailer.displayName}
              items={items}
            />
          ) : null,
        )
      )}
    </div>
  );
}
