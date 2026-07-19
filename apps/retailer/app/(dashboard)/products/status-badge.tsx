import type { ProductStatus } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";

const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

const STATUS_TONE: Record<ProductStatus, "neutral" | "success" | "warning"> = {
  draft: "warning",
  active: "success",
  archived: "neutral",
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
