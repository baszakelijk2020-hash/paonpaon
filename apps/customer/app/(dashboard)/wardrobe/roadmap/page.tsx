import {
  CustomerRepository,
  RetailerRepository,
  WardrobeRoadmapRepository,
} from "@paon/database";

import { CustomerApprovedRoadmapPanel } from "../roadmap-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function WardrobeRoadmapPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const roadmapRepo = new WardrobeRoadmapRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const roadmap = await roadmapRepo.findApprovedByCustomer(customer.id);
      const outfits = roadmap
        ? await roadmapRepo.findOutfitsByCustomer(
            customer.retailerId,
            customer.id,
            { approvedOnly: true },
          )
        : [];
      return { customer, retailer, roadmap, outfits };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Wardrobe Roadmap
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Approved advisor plans and complete looks for each house relationship.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          Link a retailer relationship to view wardrobe roadmaps.
        </p>
      ) : (
        groups.map(({ customer, retailer, roadmap, outfits }) => (
          <CustomerApprovedRoadmapPanel
            key={customer.id}
            retailerName={retailer?.displayName ?? "Retailer"}
            roadmap={roadmap}
            outfits={outfits}
          />
        ))
      )}
    </div>
  );
}
