import {
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";

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
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
