import type { RetailerStatus } from "@paon/domain";
import { RETAILER_STATUS_LABELS } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";

const STATUS_TONE: Record<
  RetailerStatus,
  "neutral" | "success" | "warning" | "danger"
> = {
  pending_onboarding: "warning",
  active: "success",
  suspended: "danger",
  churned: "neutral",
};

export function RetailerStatusBadge({ status }: { status: RetailerStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]}>{RETAILER_STATUS_LABELS[status]}</Badge>
  );
}
