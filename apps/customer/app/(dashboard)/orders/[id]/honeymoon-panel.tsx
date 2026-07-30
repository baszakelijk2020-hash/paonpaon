import { HoneymoonRepository } from "@paon/database";
import { Button } from "@paon/ui/components/Button";
import Link from "next/link";

import { completeHoneymoonMilestone } from "./honeymoon-actions";

import type { OrderHoneymoonMilestone } from "@paon/database";

export function HoneymoonTrackerPanel({
  orderId,
  milestones,
}: {
  orderId: string;
  milestones: OrderHoneymoonMilestone[];
}) {
  if (milestones.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-5">
      <h2 className="font-display text-xl text-[var(--color-stone-900)]">
        Honeymoon Phase
      </h2>
      <p className="mt-1 text-sm text-[var(--color-stone-500)]">
        Preparation, collection, and aftercare actions with honest stock and
        lead-time truth. Outreach respects contact-pressure limits.
      </p>
      <ol className="mt-4 space-y-4">
        {milestones.map((milestone) => (
          <li
            key={milestone.id}
            className="border-t border-[var(--color-stone-100)] pt-4 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {milestone.title}
                  <span className="ml-2 text-xs font-normal capitalize text-[var(--color-stone-500)]">
                    {milestone.kind} · {milestone.status}
                  </span>
                </p>
                <p className="mt-1 text-sm text-[var(--color-stone-600)]">
                  {milestone.explanation}
                </p>
                {milestone.leadTimeTruth ? (
                  <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                    Lead time: {milestone.leadTimeTruth}
                  </p>
                ) : null}
                {milestone.stockTruth ? (
                  <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                    Stock: {milestone.stockTruth}
                  </p>
                ) : null}
                {milestone.suppressReason ? (
                  <p className="mt-1 text-xs text-[var(--color-warning-500)]">
                    {milestone.suppressReason}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {milestone.actionHref &&
                milestone.status !== "completed" &&
                milestone.status !== "suppressed" ? (
                  <Link href={milestone.actionHref}>
                    <Button size="sm" variant="outline">
                      Open
                    </Button>
                  </Link>
                ) : null}
                {milestone.status === "available" ? (
                  <form action={completeHoneymoonMilestone}>
                    <input
                      type="hidden"
                      name="milestoneId"
                      value={milestone.id}
                    />
                    <input type="hidden" name="orderId" value={orderId} />
                    <Button type="submit" size="sm">
                      Mark done
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export async function loadHoneymoonMilestones(args: {
  readonly orderId: string;
  readonly orderStatus: import("@paon/domain").OrderStatus;
  readonly placedAt?: string;
  readonly lines: readonly {
    readonly productVariantId: string;
    readonly sku?: string;
    readonly quantity: number;
    readonly requiresProduction: boolean;
    readonly requiresAlteration: boolean;
    readonly leadTimeDays?: number | null;
    readonly inventoryQuantity?: number | null;
  }[];
  readonly supabase: import("@paon/database").PaonSupabaseClient;
}): Promise<OrderHoneymoonMilestone[]> {
  const trackable = [
    "placed",
    "in_production",
    "ready_for_fulfillment",
    "shipped",
    "delivered",
    "completed",
  ];
  if (!trackable.includes(args.orderStatus)) {
    return [];
  }

  const repo = new HoneymoonRepository(args.supabase);
  await repo.syncMilestonesForOrder({
    orderId: args.orderId as never,
    orderStatus: args.orderStatus,
    ...(args.placedAt ? { placedAt: args.placedAt } : {}),
    lines: args.lines,
    nowUtcIso: new Date().toISOString(),
    recentTouchCount: 0,
  });
  return repo.listMilestonesForOrder(args.orderId as never);
}
