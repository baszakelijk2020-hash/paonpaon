import type { AlterationStatus } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";

const STATUS_TONE: Record<AlterationStatus, "neutral" | "success" | "warning"> =
  {
    requested: "warning",
    measured: "warning",
    in_progress: "warning",
    ready_for_fitting: "warning",
    ready_for_pickup: "success",
    complete: "success",
  };

export function AlterationStatusBadge({
  status,
}: {
  status: AlterationStatus;
}) {
  return (
    <Badge tone={STATUS_TONE[status]} className="capitalize">
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
