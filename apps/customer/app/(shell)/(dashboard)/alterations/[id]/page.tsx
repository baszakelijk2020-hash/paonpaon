import {
  CustomerAlterationRepository,
  RetailerRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import { notFound } from "next/navigation";

import { AlterationStatusBadge } from "../status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function AlterationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const alterationRepo = new CustomerAlterationRepository(supabase);
  const alteration = await alterationRepo.findById(asId<"AlterationId">(id));
  if (!alteration) {
    notFound();
  }

  const [retailer, updates, fulfillment] = await Promise.all([
    new RetailerRepository(supabase).findById(alteration.retailerId),
    alterationRepo.findTimeline(alteration.id),
    alterationRepo.findFulfillment(alteration.id),
  ]);
  const latestFulfillment = fulfillment[0];
  const deliveryAddress =
    latestFulfillment?.delivery_address &&
    typeof latestFulfillment.delivery_address === "object" &&
    !Array.isArray(latestFulfillment.delivery_address)
      ? latestFulfillment.delivery_address
      : null;
  const deliveryAddressParts = deliveryAddress
    ? [
        deliveryAddress["line1"],
        deliveryAddress["line2"],
        deliveryAddress["city"],
        deliveryAddress["region"],
        deliveryAddress["postalCode"],
        deliveryAddress["countryCode"],
      ].filter((part): part is string => typeof part === "string" && !!part)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
            {retailer?.displayName ?? "Unknown retailer"}
          </h1>
          <AlterationStatusBadge status={alteration.status} />
        </div>
        {alteration.dueDate ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            Due {formatDate(alteration.dueDate, "en-US")}
          </p>
        ) : null}
        <p className="text-sm text-[var(--color-stone-700)]">
          {alteration.brand ? `${alteration.brand} ` : ""}
          {alteration.garmentType} · {alteration.workOrderNumber}
        </p>
      </div>

      {alteration.status === "ready_for_pickup" ? (
        <div className="bg-[var(--color-success-500)]/10 rounded-[var(--radius-md)] px-6 py-4">
          <p className="font-medium text-[var(--color-success-500)]">
            Ready for pickup
          </p>
          <p className="text-sm text-[var(--color-stone-700)]">
            Visit the store whenever suits you to collect your item.
          </p>
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Updates
        </h2>
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {updates.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-stone-500)]">
              No updates yet.
            </p>
          ) : (
            updates.map((update) => (
              <div key={update.id} className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <AlterationStatusBadge status={update.to_status!} />
                  <span className="text-xs text-[var(--color-stone-500)]">
                    {formatDate(update.created_at!, "en-US")}
                  </span>
                </div>
                {update.note ? (
                  <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                    {update.note}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </Card>
      </div>

      {latestFulfillment ? (
        <div>
          <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
            Pickup or delivery
          </h2>
          <Card>
            <p className="text-[var(--color-stone-900)]">
              {latestFulfillment.method === "pickup" ? "Pick-up" : "Delivery"} ·{" "}
              {latestFulfillment.status
                ? ((
                    {
                      scheduled: "Scheduled",
                      ready: "Ready",
                      dispatched: "Dispatched",
                      completed: "Completed",
                      canceled: "Cancelled",
                    } as Record<string, string>
                  )[latestFulfillment.status] ?? latestFulfillment.status)
                : null}
            </p>
            {latestFulfillment.scheduled_at ? (
              <p className="text-sm text-[var(--color-stone-500)]">
                Scheduled {formatDate(latestFulfillment.scheduled_at, "en-US")}
              </p>
            ) : null}
            {deliveryAddressParts.length > 0 ? (
              <p className="text-sm text-[var(--color-stone-500)]">
                {deliveryAddressParts.join(", ")}
              </p>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
