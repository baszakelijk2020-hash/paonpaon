import { CustomerRepository, RetailerRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function DashboardPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const relationships = await Promise.all(
    customers.map(async (customer) => ({
      customer,
      retailer: await retailerRepo.findById(customer.retailerId),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
          Your relationships
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          {relationships.length} retailer
          {relationships.length === 1 ? "" : "s"}
        </p>
      </div>

      {relationships.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            You don&rsquo;t have any retailer relationships yet. Once a retailer
            you&rsquo;ve shopped with adds you as a client (or you place an
            order once storefronts are live), it&rsquo;ll show up here.
          </p>
        </div>
      ) : (
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {relationships.map(({ customer, retailer }) => (
            <div key={customer.id} className="px-6 py-4">
              <p className="font-medium text-[var(--color-stone-900)]">
                {retailer?.displayName ?? "Unknown retailer"}
              </p>
              <p className="text-sm capitalize text-[var(--color-stone-500)]">
                {customer.lifecycleStage.replaceAll("_", " ")}
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
