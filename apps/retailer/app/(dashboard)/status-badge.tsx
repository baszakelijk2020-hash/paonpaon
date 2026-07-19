import type { RetailerStatus } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";

const STATUS_LABEL: Record<RetailerStatus, string> = {
  pending_onboarding: "Pending onboarding",
  active: "Active",
  suspended: "Suspended",
  churned: "Churned",
};

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
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
