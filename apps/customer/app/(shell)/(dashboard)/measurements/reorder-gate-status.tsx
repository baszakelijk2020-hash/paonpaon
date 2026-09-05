"use client";

import { Card } from "@paon/ui/components/Card";

interface ReorderGateStatusProps {
  readonly allowed: boolean;
  readonly reason?:
    | "measurement_version_superseded"
    | "open_advisor_review"
    | "no_approved_measurements"
    | undefined;
}

/**
 * Displays the reorder gate status for a customer. Shows "Clear to order"
 * when allowed, or the specific reason why reordering is blocked.
 */
export function ReorderGateStatus({ allowed, reason }: ReorderGateStatusProps) {
  return (
    <Card className="rounded-[var(--radius-md)]">
      <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
        Reorder status
      </p>
      {allowed ? (
        <>
          <p className="mt-3 text-lg font-medium text-[var(--color-success-700)]">
            Clear to order
          </p>
          <p className="mt-2 text-sm text-[var(--color-stone-600)]">
            Your measurements are approved and ready for new garments.
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-lg font-medium text-[var(--color-warning-700)]">
            Reorder blocked
          </p>
          <p className="mt-2 text-sm text-[var(--color-stone-600)]">
            {reason === "no_approved_measurements"
              ? "You don't have any approved measurements yet. An advisor will help you create your first measurement record."
              : reason === "open_advisor_review"
                ? "Your latest measurements are under review. An advisor will confirm them before new orders can use them."
                : reason === "measurement_version_superseded"
                  ? "Your measurements have been updated since your last order. An advisor will confirm the new measurements before you order again."
                  : "Your measurements need review before you can order again."}
          </p>
        </>
      )}
    </Card>
  );
}
