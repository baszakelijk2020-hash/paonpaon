import {
  CustomerRepository,
  RetailerRepository,
  WardrobeLifecycleRepository,
  WardrobeRepository,
  WardrobeRoadmapRepository,
  WardrobeSelfScanRepository,
} from "@paon/database";
import type { WardrobeOwnershipEvent } from "@paon/domain";

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
  const lifecycleRepo = new WardrobeLifecycleRepository(supabase);
  const selfScanRepo = new WardrobeSelfScanRepository(supabase);
  const roadmapRepo = new WardrobeRoadmapRepository(supabase);

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

      const lifecycleEntries = await Promise.all(
        items.map(async (item) => {
          const [serviceView, selfReports] = await Promise.all([
            lifecycleRepo.buildServiceView({ item }),
            selfScanRepo.findByWardrobeItem(item.id),
          ]);
          const orderStatus = item.orderLineId
            ? await selfScanRepo.findOrderStatusForLine(item.orderLineId)
            : null;
          return [
            item.id,
            {
              guidance: serviceView.guidance,
              fitFreshness: serviceView.fitFreshness,
              selfReports: selfReports.map(({ report, signedUrl }) => ({
                report,
                ...(signedUrl ? { signedUrl } : {}),
              })),
              orderStatus,
            },
          ] as const;
        }),
      );
      const lifecycleByItemId = Object.fromEntries(lifecycleEntries);

      const roadmaps = await roadmapRepo.findByCustomer(customer.id, {
        customerVisibleOnly: true,
      });
      return {
        customer,
        retailer,
        items,
        historyByItemId,
        lifecycleByItemId,
        roadmaps,
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
          What you own with each house — purchases and external pieces, fit
          freshness from official fittings, lifecycle guidance, and self-scan
          notes that never become formal measurements.
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
            lifecycleByItemId,
            roadmaps,
          }) => (
            <div key={customer.id} className="flex flex-col gap-4">
              <WardrobeHousePanel
                retailerId={customer.retailerId}
                retailerSlug={retailer?.slug ?? "retailer"}
                retailerName={retailer?.displayName ?? "Retailer"}
                customerId={customer.id}
                items={items}
                historyByItemId={historyByItemId}
                lifecycleByItemId={lifecycleByItemId}
              />
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
