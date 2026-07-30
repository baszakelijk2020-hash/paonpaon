import {
  CustomerRepository,
  ForYouRepository,
  RetailerRepository,
} from "@paon/database";
import { asId } from "@paon/domain";

import { ForYouPanel } from "./for-you-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ForYouPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const forYouRepo = new ForYouRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const customerId = asId<"CustomerId">(customer.id);
      const retailerId = asId<"RetailerId">(customer.retailerId);
      const projection = await forYouRepo.projectForCustomer({
        retailerId,
        customerId,
        viewerCustomerId: customerId,
      });
      return { customer, retailer, projection };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          For you
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          One place for explainable recommendations — favourites, Tie-Mate,
          wardrobe gaps, advisor notes, and recent behaviour combined with
          inventory-aware ranking.
        </p>
      </div>

      {groups.length === 0 ? (
        <div
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center"
          role="status"
        >
          <p className="text-[var(--color-stone-600)]">
            No house connections yet.
          </p>
        </div>
      ) : (
        groups.map(({ customer, retailer, projection }) => (
          <ForYouPanel
            key={customer.id}
            retailerId={customer.retailerId}
            retailerName={retailer?.displayName ?? "Retailer"}
            retailerSlug={retailer?.slug ?? "store"}
            customerId={customer.id}
            visibility={projection.visibility}
            signalsUsed={projection.provenance.signalsUsed}
            recommendations={projection.recommendations.map((item) => ({
              rank: item.rank,
              productId: String(item.productId),
              ...(item.productVariantId
                ? { productVariantId: String(item.productVariantId) }
                : {}),
              displayName: item.displayName,
              productSlug: item.productSlug,
              ...(item.primaryImageUrl
                ? { primaryImageUrl: item.primaryImageUrl }
                : {}),
              statement: item.statement,
              factors: item.factors.map((factor) => ({
                code: factor.code,
                detail: factor.detail,
              })),
            }))}
          />
        ))
      )}
    </div>
  );
}
