"use client";

import type { OneClickCheckoutStatus } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  requestOneClickCheckoutEligibility,
  type OneClickCheckoutState,
} from "./actions";

interface OneClickStatusCardProps {
  retailerId: string;
  status: OneClickCheckoutStatus;
}

export function OneClickStatusCard({
  retailerId,
  status,
}: OneClickStatusCardProps) {
  const [state, formAction, isPending] = useActionState(
    requestOneClickCheckoutEligibility,
    {} as OneClickCheckoutState,
  );

  const isNotRequested = status === "not_requested";
  const isPending_ = status === "pending_review";
  const isEligibleOrActive = status === "eligible" || status === "active";

  return (
    <div
      className="rounded-lg border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-4"
      aria-label="1-Click Checkout status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">
            1-Click Checkout
            {isEligibleOrActive && " — Active"}
          </h3>
          <p className="mt-1 text-xs text-white/60">
            {isNotRequested &&
              "Skip checkout entirely on future orders — by invitation, at your advisor's discretion."}
            {isPending_ &&
              "Eligibility requested — your advisor will confirm shortly."}
            {isEligibleOrActive &&
              "Confirmed for your account. Card connection is being finalized before checkout goes fully one-click."}
          </p>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="mt-2 text-xs text-[#ff6b6b]">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="mt-2 text-xs text-[#90ee90]">
          Request submitted. Your advisor will confirm shortly.
        </p>
      )}
      {isNotRequested && (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="retailerId" value={retailerId} />
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className="w-full"
          >
            {isPending ? "Checking…" : "Check eligibility"}
          </Button>
        </form>
      )}
    </div>
  );
}
