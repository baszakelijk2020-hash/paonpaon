"use client";

import type { RetailerStripeAccount } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import {
  connectStripeAccount,
  openStripeExpressDashboard,
  type PaymentsActionState,
} from "./actions";

const initial: PaymentsActionState = {};

export function PaymentsPanel({
  account,
  stripeConfigured,
}: {
  account: RetailerStripeAccount | null;
  stripeConfigured: boolean;
}) {
  const [connectState, connectAction, connecting] = useActionState(
    connectStripeAccount,
    initial,
  );
  const [dashboardState, dashboardAction, openingDashboard] = useActionState(
    openStripeExpressDashboard,
    initial,
  );

  if (!stripeConfigured) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Customer payments
        </h2>
        <p className="text-sm text-[var(--color-stone-600)]">
          Stripe is not configured on this deployment yet. A platform operator
          needs to provision a Stripe account and set{" "}
          <code>STRIPE_SECRET_KEY</code> before retailers can connect.
        </p>
      </Card>
    );
  }

  const fullyOnboarded = account?.chargesEnabled && account.payoutsEnabled;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Customer payments
        </h2>
        <p className="text-sm text-[var(--color-stone-600)]">
          Connect a Stripe account to accept customer payments. You are the
          merchant of record — payouts go directly to your own bank account.
        </p>
      </div>

      {account ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={account.chargesEnabled ? "success" : "warning"}>
            {account.chargesEnabled ? "Charges enabled" : "Charges pending"}
          </Badge>
          <Badge tone={account.payoutsEnabled ? "success" : "warning"}>
            {account.payoutsEnabled ? "Payouts enabled" : "Payouts pending"}
          </Badge>
          {!account.detailsSubmitted ? (
            <Badge tone="warning">Onboarding incomplete</Badge>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-stone-500)]">Not connected.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <form action={connectAction}>
          <Button type="submit" disabled={connecting}>
            {connecting
              ? "Redirecting…"
              : account
                ? fullyOnboarded
                  ? "Reconnect with Stripe"
                  : "Finish onboarding"
                : "Connect with Stripe"}
          </Button>
        </form>
        {account ? (
          <form action={dashboardAction}>
            <Button
              type="submit"
              variant="secondary"
              disabled={openingDashboard}
            >
              {openingDashboard ? "Opening…" : "Manage on Stripe"}
            </Button>
          </form>
        ) : null}
      </div>

      {connectState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {connectState.formError}
        </p>
      ) : null}
      {dashboardState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {dashboardState.formError}
        </p>
      ) : null}
    </Card>
  );
}
