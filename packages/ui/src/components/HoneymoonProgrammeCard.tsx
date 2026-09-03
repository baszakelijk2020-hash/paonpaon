import { Card } from "@paon/ui/components/Card";
import Link from "next/link";

const KIND_LABELS: Record<string, string> = {
  preparation: "Preparation",
  collection: "Collection",
  aftercare: "Aftercare",
};

export interface HoneymoonProgrammeCardAction {
  readonly kind: string;
  readonly title: string;
  readonly dueHint: string;
  readonly suppressed: boolean;
  readonly suppressionReason?: string;
}

export interface HoneymoonProgrammeCardProps {
  readonly orderId: string;
  readonly payAtDelivery: boolean;
  readonly actions: readonly HoneymoonProgrammeCardAction[];
  readonly showLookPlanLink?: boolean;
}

/**
 * Order-to-delivery tracker (PHASE 10.2 / CMP-106). Every action already
 * carries honest suppression — this renders exactly what deriveHoneymoonActions
 * decided, it never re-derives or overrides urgency.
 */
export function HoneymoonProgrammeCard({
  orderId,
  payAtDelivery,
  actions,
  showLookPlanLink = false,
}: HoneymoonProgrammeCardProps) {
  return (
    <Card data-testid="honeymoon-programme-card">
      <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
        Preparation & aftercare
      </h2>
      {payAtDelivery ? (
        <p className="mt-1 text-xs text-[var(--color-stone-500)]">
          Pay at delivery — no online charge has been attempted for this order.
        </p>
      ) : null}
      <ul className="mt-3 flex flex-col gap-3 text-sm">
        {actions.map((action) => (
          <li
            key={action.kind}
            className="border-b border-[var(--color-stone-100)] pb-3 last:border-0"
          >
            <p className="font-medium text-[var(--color-stone-900)]">
              {KIND_LABELS[action.kind] ?? action.kind} — {action.title}
            </p>
            <p className="mt-1 text-[var(--color-stone-600)]">
              {action.dueHint}
            </p>
            {action.suppressed ? (
              <p className="mt-1 text-xs text-[var(--color-stone-400)]">
                Not yet actionable
                {action.suppressionReason
                  ? ` — ${action.suppressionReason}`
                  : ""}
                .
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {showLookPlanLink ? (
        <Link
          href={`/orders/${orderId}/honeymoon-campaign-challenge-look`}
          className="mt-4 inline-block text-sm text-[var(--color-stone-900)] underline underline-offset-4"
        >
          See your seven-day look plan
        </Link>
      ) : null}
    </Card>
  );
}
