import {
  CustomerRepository,
  RetailerRepository,
  WardrobeLifecycleRepository,
  WardrobeRepository,
  WardrobeRoadmapRepository,
  type WardrobeItemServiceView,
} from "@paon/database";
import type { WardrobeOwnershipEvent } from "@paon/domain";

import { WardrobeLifecyclePanel } from "./lifecycle-panel";
import { WardrobeRoadmapPanel } from "./roadmap-panel";
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
  const roadmapRepo = new WardrobeRoadmapRepository(supabase);
  const lifecycleRepo = new WardrobeLifecycleRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const items = await wardrobeRepo.findByCustomer(customer.id);
      const historyEntries = await Promise.all(
        items.map(async (item) => {
          const events = await wardrobeRepo.listOwnershipHistory(item.id);
          return [item.id, events] as const;
        }),
      );
      const historyByItemId: Record<string, readonly WardrobeOwnershipEvent[]> =
        Object.fromEntries(historyEntries);
      const roadmaps = await roadmapRepo.findByCustomer(customer.id, {
        customerVisibleOnly: true,
      });
      const serviceViews: WardrobeItemServiceView[] = await Promise.all(
        items.map((item) => lifecycleRepo.projectItemServiceView(item)),
      );
      return {
        customer,
        retailer,
        items,
        historyByItemId,
        roadmaps,
        serviceViews,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Wardrobe
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          What you own with each house — purchases and external pieces, kept
          separate from fitting garments — plus fit freshness, longevity
          guidance, self-scan, and advisor roadmaps.
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
        groups.map(
          ({
            customer,
            retailer,
            items,
            historyByItemId,
            roadmaps,
            serviceViews,
          }) => (
            <div key={customer.id} className="flex flex-col gap-4">
              <WardrobeHousePanel
                retailerId={customer.retailerId}
                retailerName={retailer?.displayName ?? "Retailer"}
                customerId={customer.id}
                items={items}
                historyByItemId={historyByItemId}
              />
              <WardrobeLifecyclePanel views={serviceViews} />
              <WardrobeRoadmapPanel
                retailerName={retailer?.displayName ?? "Retailer"}
                roadmaps={roadmaps}
              />
            </div>
          ),
        )
      )}
    </div>
  );
}
