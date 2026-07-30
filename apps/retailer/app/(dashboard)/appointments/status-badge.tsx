"use client";

import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@paon/domain";
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
  label,
}: {
  status: AppointmentStatus;
  label: string;
}) {
  return <Badge tone={STATUS_TONE[status]}>{label}</Badge>;
}

export { APPOINTMENT_STATUSES };
