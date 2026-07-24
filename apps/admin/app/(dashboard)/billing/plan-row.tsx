"use client";

import type { CommercialFeature, SubscriptionPlan } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { formatMoney } from "@paon/utils";
import { useActionState } from "react";

import {
  updateCommercialPlan,
  updatePlanPrice,
  type BillingActionState,
} from "./actions";

const initial: BillingActionState = {};

export function PlanRow({
  plan,
  features,
}: {
  plan: SubscriptionPlan;
  features: CommercialFeature[];
}) {
  const [commercialState, commercialAction, commercialPending] = useActionState(
    updateCommercialPlan,
    initial,
  );
  const [stripeState, stripeAction, stripePending] = useActionState(
    updatePlanPrice,
    initial,
  );

  return (
    <Card className="overflow-hidden rounded-[var(--radius-xl)] p-0 shadow-[var(--shadow-lifted)]">
      <div className="grid gap-6 border-b border-[var(--color-stone-100)] p-6 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-3xl font-[var(--font-display)]">{plan.name}</p>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            {plan.positioning}
          </p>
        </div>
        <div className="text-left lg:text-right">
          <p className="text-2xl font-[var(--font-display)]">
            {plan.priceIsFrom ? "From " : ""}
            {formatMoney(plan.price, "en-US")} / month
          </p>
          <p className="text-sm text-[var(--color-stone-500)]">
            {formatMoney(plan.implementationFee, "en-US")} implementation
          </p>
        </div>
      </div>

      <form action={commercialAction} className="flex flex-col gap-6 p-6">
        <input type="hidden" name="planId" value={plan.id} />
        <div className="grid gap-4 lg:grid-cols-2">
          <label htmlFor={`name-${plan.id}`} className="text-sm font-medium">
            Plan name
            <Input
              id={`name-${plan.id}`}
              name="name"
              defaultValue={plan.name}
              className="mt-1"
            />
          </label>
          <label
            htmlFor={`positioning-${plan.id}`}
            className="text-sm font-medium"
          >
            Positioning
            <Input
              id={`positioning-${plan.id}`}
              name="positioning"
              defaultValue={plan.positioning}
              className="mt-1"
            />
          </label>
        </div>
        <label className="text-sm font-medium">
          Description
          <textarea
            name="description"
            defaultValue={plan.description}
            maxLength={1000}
            className="mt-1 min-h-24 w-full rounded-[var(--radius-sm)] border bg-white p-3 text-sm"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label htmlFor={`monthly-${plan.id}`} className="text-sm font-medium">
            Monthly price · minor units
            <Input
              id={`monthly-${plan.id}`}
              name="priceAmountMinorUnits"
              type="number"
              min={0}
              defaultValue={plan.price.amountMinorUnits}
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium">
            Subscription currency
            <select
              name="priceCurrency"
              defaultValue={plan.price.currency}
              className="mt-1 h-10 w-full rounded-[var(--radius-sm)] border bg-white px-3 text-sm"
            >
              {["EUR", "GBP", "USD", "CHF"].map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
          </label>
          <label
            htmlFor={`implementation-${plan.id}`}
            className="text-sm font-medium"
          >
            Implementation fee · minor units
            <Input
              id={`implementation-${plan.id}`}
              name="implementationFeeAmountMinorUnits"
              type="number"
              min={0}
              defaultValue={plan.implementationFee.amountMinorUnits}
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium">
            Implementation currency
            <select
              name="implementationFeeCurrency"
              defaultValue={plan.implementationFee.currency}
              className="mt-1 h-10 w-full rounded-[var(--radius-sm)] border bg-white px-3 text-sm"
            >
              {["EUR", "GBP", "USD", "CHF"].map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <label htmlFor={`seats-${plan.id}`} className="text-sm font-medium">
            Seat limit
            <Input
              id={`seats-${plan.id}`}
              name="seatLimit"
              type="number"
              min={1}
              defaultValue={plan.seatLimit ?? ""}
              placeholder="Unlimited"
              className="mt-1"
            />
          </label>
          <div className="flex flex-wrap items-end gap-5 pb-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="priceIsFrom"
                defaultChecked={plan.priceIsFrom}
              />
              Display pricing as “from”
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isPublic"
                defaultChecked={plan.isPublic}
              />
              Publicly visible
            </label>
          </div>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Included capabilities</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <label
                key={feature.key}
                className="flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="includedFeatureKeys"
                  value={feature.key}
                  defaultChecked={plan.includedFeatureKeys.includes(
                    feature.key,
                  )}
                />
                <span>
                  {feature.name}
                  <span className="block text-[10px] uppercase tracking-wide text-[var(--color-stone-400)]">
                    {feature.category}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={commercialPending}>
            {commercialPending ? "Saving catalogue…" : "Save commercial plan"}
          </Button>
          {commercialState.formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {commercialState.formError}
            </p>
          ) : null}
          {commercialState.saved ? (
            <p
              role="status"
              className="text-sm text-[var(--color-success-500)]"
            >
              Commercial plan saved.
            </p>
          ) : null}
        </div>
      </form>

      <form
        action={stripeAction}
        className="flex flex-col gap-3 border-t border-[var(--color-stone-100)] bg-[var(--color-stone-50)] p-6 sm:flex-row sm:items-end"
      >
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
        <Button type="submit" size="sm" disabled={stripePending}>
          {stripePending ? "Saving…" : "Save Stripe bridge"}
        </Button>
        {stripeState.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {stripeState.formError}
          </p>
        ) : null}
        {stripeState.saved ? (
          <p role="status" className="text-sm text-[var(--color-success-500)]">
            Stripe bridge saved.
          </p>
        ) : null}
      </form>
      {!plan.providerPriceId ? (
        <p className="border-[var(--color-warning-500)]/20 bg-[var(--color-warning-500)]/10 border-t px-6 py-3 text-sm">
          No Stripe Price configured — this package can be presented but not
          activated as a live subscription.
        </p>
      ) : null}
    </Card>
  );
}
