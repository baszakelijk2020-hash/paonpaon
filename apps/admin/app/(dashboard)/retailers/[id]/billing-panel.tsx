"use client";

import type { RetailerSubscription, SubscriptionPlan } from "@paon/domain";
import { SUBSCRIPTION_STATUS_LABELS } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { ConfirmSubmitButton } from "@paon/ui/components/ConfirmSubmitButton";
import { Select } from "@paon/ui/components/Select";
import { formatDate, formatMoney } from "@paon/utils";
import { useActionState } from "react";

import {
  assignSubscriptionPlan,
  cancelSubscription,
  changeSubscriptionPlan,
  type BillingActionState,
} from "./actions";

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
  const [changeState, changeAction, changePending] = useActionState(
    changeSubscriptionPlan,
    initial,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelSubscription,
    initial,
  );
  const otherPlans = assignablePlans.filter(
    (candidate) => candidate.id !== plan?.id,
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
            {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
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
      ) : null}

      {subscription && subscription.status !== "canceled" ? (
        <div className="flex flex-col gap-3 border-t border-[var(--color-stone-100)] pt-4">
          {otherPlans.length > 0 ? (
            <form action={changeAction} className="flex items-end gap-2">
              <input type="hidden" name="retailerId" value={retailerId} />
              <div className="flex-1">
                <label
                  htmlFor="changePlanId"
                  className="mb-1 block text-xs font-medium text-[var(--color-stone-600)]"
                >
                  Change plan
                </label>
                <Select id="changePlanId" name="planId">
                  {otherPlans.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} — {formatMoney(candidate.price, "en-US")}
                      /{candidate.billingInterval}
                    </option>
                  ))}
                </Select>
              </div>
              <ConfirmSubmitButton
                variant="outline"
                confirmMessage={`Change this retailer's plan? Stripe will prorate the difference immediately.`}
                disabled={changePending}
              >
                {changePending ? "Changing…" : "Change plan"}
              </ConfirmSubmitButton>
            </form>
          ) : null}
          {changeState.formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {changeState.formError}
            </p>
          ) : null}
          {changeState.saved ? (
            <p
              role="status"
              className="text-sm text-[var(--color-success-500)]"
            >
              Plan changed.
            </p>
          ) : null}

          <form action={cancelAction}>
            <input type="hidden" name="retailerId" value={retailerId} />
            <ConfirmSubmitButton
              variant="destructive"
              size="sm"
              confirmMessage="Cancel this retailer's subscription immediately? This stops billing right away and cannot be undone here."
              disabled={cancelPending}
            >
              {cancelPending ? "Cancelling…" : "Cancel subscription"}
            </ConfirmSubmitButton>
          </form>
          {cancelState.formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {cancelState.formError}
            </p>
          ) : null}
          {cancelState.saved ? (
            <p
              role="status"
              className="text-sm text-[var(--color-success-500)]"
            >
              Subscription cancelled.
            </p>
          ) : null}
        </div>
      ) : null}

      {subscription?.status === "canceled" ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          Subscription cancelled. The schema allows one subscription record per
          retailer, so reassigning a new plan after cancellation needs a direct
          database fix rather than this form.
        </p>
      ) : null}

      {!subscription ? (
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
      ) : null}

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </Card>
  );
}
