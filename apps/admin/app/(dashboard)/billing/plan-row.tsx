"use client";

import type { SubscriptionPlan } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { formatMoney } from "@paon/utils";
import { useActionState } from "react";

import { updatePlanPrice, type BillingActionState } from "./actions";

const initial: BillingActionState = {};

export function PlanRow({ plan }: { plan: SubscriptionPlan }) {
  const [state, action, pending] = useActionState(updatePlanPrice, initial);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-[var(--color-stone-900)]">
            {plan.name}
          </p>
          <p className="text-sm text-[var(--color-stone-500)]">
            {formatMoney(plan.price, "en-US")} / {plan.billingInterval}
            {plan.seatLimit ? ` · up to ${plan.seatLimit} seats` : ""}
          </p>
        </div>
        <span className="text-xs text-[var(--color-stone-500)]">
          key: {plan.key}
        </span>
      </div>
      <form action={action} className="flex items-end gap-2">
        <input type="hidden" name="planId" value={plan.id} />
        <div className="flex-1">
          <label
            htmlFor={`price-${plan.id}`}
            className="mb-1 block text-xs font-medium text-[var(--color-stone-600)]"
          >
            Stripe Price id
          </label>
          <Input
            id={`price-${plan.id}`}
            name="providerPriceId"
            defaultValue={plan.providerPriceId}
            placeholder="price_..."
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Saved.
        </p>
      ) : null}
      {!plan.providerPriceId ? (
        <p className="text-sm text-[var(--color-warning-500)]">
          No Stripe Price configured yet — retailers can&rsquo;t be assigned
          this plan until one is set.
        </p>
      ) : null}
    </Card>
  );
}
