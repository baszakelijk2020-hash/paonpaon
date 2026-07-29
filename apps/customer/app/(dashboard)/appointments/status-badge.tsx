import type { AppointmentStatus } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { humaniseStatus } from "@paon/utils";

const STATUS_LABEL: Partial<Record<AppointmentStatus, string>> = {
  no_show: "No-show",
  checked_in: "Checked in",
};

const STATUS_TONE: Record<
  AppointmentStatus,
  "neutral" | "success" | "warning" | "danger"
> = {
  requested: "warning",
  confirmed: "success",
  checked_in: "success",
  completed: "success",
  canceled: "danger",
  no_show: "danger",
};

export function AppointmentStatusBadge({
  status,
}: {
  status: AppointmentStatus;
}) {
  return (
    <Badge tone={STATUS_TONE[status]}>
      {STATUS_LABEL[status] ?? humaniseStatus(status)}
    </Badge>
  );
}
