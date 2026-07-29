import { notFound } from "next/navigation";

import { loadMorningRoutineRetailerPageData } from "./actions";
import { MorningRoutineRetailerSettingsForm } from "./retailer-settings-form";

import { requireSession } from "@/lib/session";

export default async function MorningRoutineRetailerSettingsPage() {
  const session = await requireSession();
  if (!["manager", "admin", "owner"].includes(session.retailerRole)) {
    notFound();
  }

  const { settings, products } = await loadMorningRoutineRetailerPageData(
    session.retailerId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          MorningRoutine
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Service-oriented delivery controls — timely wardrobe guidance, not
          generic advertising.
        </p>
      </div>
      <MorningRoutineRetailerSettingsForm
        settings={{
          enabled: settings.enabled,
          deliveryHourLocal: settings.deliveryHourLocal,
          eligibleProductIds: settings.eligibleProductIds,
        }}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
        }))}
      />
    </div>
  );
}
