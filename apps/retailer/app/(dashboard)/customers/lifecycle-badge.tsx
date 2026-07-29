import {
  CUSTOMER_LIFECYCLE_STAGE_LABELS,
  type CustomerLifecycleStage,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";

export { CUSTOMER_LIFECYCLE_STAGE_LABELS as LIFECYCLE_STAGE_LABEL };

const STAGE_TONE: Record<
  CustomerLifecycleStage,
  "neutral" | "success" | "warning" | "danger"
> = {
  prospect: "neutral",
  first_purchase: "success",
  returning: "success",
  vip: "warning",
  lapsed: "danger",
};

export function LifecycleBadge({ stage }: { stage: CustomerLifecycleStage }) {
  return (
    <Badge tone={STAGE_TONE[stage]}>
      {CUSTOMER_LIFECYCLE_STAGE_LABELS[stage]}
    </Badge>
  );
}
