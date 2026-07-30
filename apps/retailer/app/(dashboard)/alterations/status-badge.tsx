import { ALTERATION_STATUS_LABELS, type AlterationStatus } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";

const STATUS_TONE: Record<AlterationStatus, "neutral" | "success" | "warning"> =
  {
    intake: "warning",
    quoted: "warning",
    awaiting_approval: "warning",
    approved: "neutral",
    assigned: "neutral",
    in_progress: "warning",
    completion_review: "warning",
    ready_for_pickup: "success",
    out_for_delivery: "success",
    completed: "success",
    canceled: "neutral",
  };

export function AlterationStatusBadge({
  status,
  label,
}: {
  status: AlterationStatus;
  label?: string;
}) {
  return (
    <Badge tone={STATUS_TONE[status]}>
      {label ?? ALTERATION_STATUS_LABELS[status]}
    </Badge>
  );
}
