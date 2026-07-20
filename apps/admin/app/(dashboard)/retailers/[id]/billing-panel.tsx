"use client";

import type { RetailerSubscription, SubscriptionPlan } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Select } from "@paon/ui/components/Select";
import { formatDate, formatMoney } from "@paon/utils";
import { useActionState } from "react";

import { assignSubscriptionPlan, type BillingActionState } from "./actions";

const initial: BillingActionState = {};

export function BillingPanel({
  retailerId,
  subscription,
  plan,
  assignablePlans,
}: {
  retailerId: string;
  subscription: RetailerSubscription | null;
  plan: SubscriptionPlan | null;
  assignablePlans: SubscriptionPlan[];
}) {
  const [state, action, pending] = useActionState(
    assignSubscriptionPlan,
    initial,
  );

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
        Billing
      </h2>

      {subscription ? (
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
          {subscription.currentPeriodEnd ? (
            <span className="text-sm text-[var(--color-stone-500)]">
              renews {formatDate(subscription.currentPeriodEnd, "en-US")}
            </span>
          ) : null}
          {subscription.cancelAtPeriodEnd ? (
            <Badge tone="danger">Cancels at period end</Badge>
          ) : null}
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--color-stone-500)]">
            No subscription yet.
          </p>
          {assignablePlans.length === 0 ? (
            <p className="text-sm text-[var(--color-warning-500)]">
              No plans have a Stripe Price configured — set one on the{" "}
              <a href="/billing" className="underline">
                Billing plans
              </a>{" "}
              page first.
            </p>
          ) : (
            <form action={action} className="flex items-end gap-2">
              <input type="hidden" name="retailerId" value={retailerId} />
              <div className="flex-1">
                <label
                  htmlFor="planId"
                  className="mb-1 block text-xs font-medium text-[var(--color-stone-600)]"
                >
                  Plan
                </label>
                <Select id="planId" name="planId">
                  {assignablePlans.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} — {formatMoney(candidate.price, "en-US")}
                      /{candidate.billingInterval}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Assigning…" : "Assign plan"}
              </Button>
            </form>
          )}
        </>
      )}

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </Card>
  );
}
