"use client";

import type { RetailerSubscription, SubscriptionPlan } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";
import { useActionState } from "react";

import { openBillingPortal, type BillingActionState } from "./actions";

const initial: BillingActionState = {};

export function BillingPanel({
  subscription,
  plan,
}: {
  subscription: RetailerSubscription | null;
  plan: SubscriptionPlan | null;
}) {
  const [state, action, pending] = useActionState(openBillingPortal, initial);

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
        Subscription
      </h2>

      {subscription ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={subscription.status === "active" ? "success" : "warning"}
            >
              {subscription.status.replaceAll("_", " ")}
            </Badge>
            <span className="text-sm text-[var(--color-stone-600)]">
              {plan?.name ?? "Unknown plan"}
              {plan
                ? ` · ${formatMoney(plan.price, "en-US")}/${plan.billingInterval}`
                : ""}
            </span>
          </div>
          {subscription.currentPeriodEnd ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
              {formatDate(subscription.currentPeriodEnd, "en-US")}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-stone-500)]">
          No subscription yet — PAON Admin assigns your plan.
        </p>
      )}

      {subscription ? (
        <form action={action}>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Opening…" : "Manage billing"}
          </Button>
        </form>
      ) : null}

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </Card>
  );
}
