import { CustomerRepository, RetailerRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";

import { ConciergeRequestForm } from "./concierge-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ConciergePage() {
  const session = await requireSession();
  const client = await getSupabaseServerClient();
  const customers = await new CustomerRepository(client).findByUserId(
    session.userId,
  );
  const retailers = new RetailerRepository(client);

  const relationships = await Promise.all(
    customers.map(async (customer) => ({
      customer,
      retailer: await retailers.findById(customer.retailerId),
    })),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Concierge
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-stone-500)]">
          Ask your advisor to book, arrange, collect, or remind — anything
          operational. Concierge requests never move money; for anything
          involving payment, your advisor will follow up directly.
        </p>
      </div>

      {relationships.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            You don&rsquo;t have a relationship with a retailer yet.
          </p>
        </Card>
      ) : (
        relationships.map(({ customer, retailer }) => (
          <Card key={customer.id}>
            <h2 className="text-sm font-medium">
              {retailer?.displayName ?? "Your retailer"}
            </h2>
            <ConciergeRequestForm retailerId={customer.retailerId} />
          </Card>
        ))
      )}
    </div>
  );
}
