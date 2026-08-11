import { Card } from "@paon/ui/components/Card";

interface ReorderGateCardProps {
  readonly allowed: boolean;
  readonly reason?:
    | "measurement_version_superseded"
    | "open_advisor_review"
    | "no_approved_measurements"
    | undefined;
}

/**
 * Displays the reorder gate status for staff viewing. Shows whether a
 * customer is clear to reorder, and if not, why. This is informational only
 * and does not block order placement.
 */
export function ReorderGateCard({ allowed, reason }: ReorderGateCardProps) {
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
            This customer&apos;s measurements are approved and ready for new
            garments.
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-lg font-medium text-[var(--color-warning-700)]">
            Reorder blocked
          </p>
          <p className="mt-2 text-sm text-[var(--color-stone-600)]">
            {reason === "no_approved_measurements"
              ? "No approved measurements yet. Advisor needs to create the first measurement record."
              : reason === "open_advisor_review"
                ? "Measurements under review. An advisor must confirm them before reordering."
                : reason === "measurement_version_superseded"
                  ? "Measurements have been updated. An advisor must confirm the new values before reordering."
                  : "Measurements need review before this customer can reorder."}
          </p>
        </>
      )}
    </Card>
  );
}
