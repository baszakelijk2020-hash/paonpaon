import type { CustomerLifecycleStage } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";

const STAGE_LABEL: Record<CustomerLifecycleStage, string> = {
  prospect: "New acquaintance",
  first_purchase: "First commission",
  returning: "Returning client",
  vip: "Private client",
  lapsed: "Quiet for a while",
};

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
  return <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>;
}
