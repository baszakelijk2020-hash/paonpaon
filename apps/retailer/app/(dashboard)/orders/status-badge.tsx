import type { OrderStatus } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";

const STATUS_TONE: Record<
  OrderStatus,
  "neutral" | "success" | "warning" | "danger"
> = {
  draft: "neutral",
  pending_payment: "warning",
  placed: "success",
  in_production: "warning",
  ready_for_fulfillment: "warning",
  shipped: "success",
  delivered: "success",
  completed: "success",
  canceled: "danger",
  refunded: "danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} className="capitalize">
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
