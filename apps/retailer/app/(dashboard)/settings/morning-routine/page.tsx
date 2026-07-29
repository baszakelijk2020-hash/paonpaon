import {
  MorningRoutineDeliveryRepository,
  ProductRepository,
} from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { notFound } from "next/navigation";

import {
  setMorningRoutineEligibleProduct,
  setMorningRoutineRetailerPaused,
} from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function MorningRoutineSettingsPage() {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    notFound();
  }

  const supabase = await getSupabaseServerClient();
  const deliveryRepo = new MorningRoutineDeliveryRepository(supabase);
  const [settings, eligible, products] = await Promise.all([
    deliveryRepo.getRetailerSettings(session.retailerId),
    deliveryRepo.listEligibleProducts(session.retailerId),
    new ProductRepository(supabase).findByRetailer(session.retailerId as never),
  ]);
  const eligibleById = new Map(
    eligible.map((row) => [row.productId, row] as const),
  );
  const activeProducts = products.filter(
    (product) => product.status === "active",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          MorningRoutine controls
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Pause delivery and allowlist catalogue products that may appear as
          secondary recommendations. Controls cannot inject unrelated promotion
          or bypass customer consent.
        </p>
      </div>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4">
        <h2 className="font-display text-lg text-[var(--color-stone-900)]">
          Delivery pause
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          Status: {settings?.paused ? "Paused" : "Active"}
        </p>
        <form action={setMorningRoutineRetailerPaused} className="mt-3">
          <input
            type="hidden"
            name="paused"
            value={settings?.paused ? "false" : "true"}
          />
          <Button type="submit" size="sm" variant="outline">
            {settings?.paused ? "Resume delivery" : "Pause delivery"}
          </Button>
        </form>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4">
        <h2 className="font-display text-lg text-[var(--color-stone-900)]">
          Eligible catalogue products
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          Only active allowlisted products may appear as catalogue secondary
          picks. Owned wardrobe recommendations are unaffected.
        </p>
        {activeProducts.length === 0 ? (
          <p
            role="status"
            className="mt-4 text-sm text-[var(--color-stone-500)]"
          >
            No active products yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-stone-100)]">
            {activeProducts.map((product) => {
              const row = eligibleById.get(product.id);
              const active = row?.active ?? false;
              return (
                <li
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm text-[var(--color-stone-900)]">
                      {product.name}
                    </p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {active ? "Eligible" : "Not eligible"}
                    </p>
                  </div>
                  <form action={setMorningRoutineEligibleProduct}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={active ? "false" : "true"}
                    />
                    <Button type="submit" size="sm" variant="outline">
                      {active ? "Remove" : "Allow"}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
