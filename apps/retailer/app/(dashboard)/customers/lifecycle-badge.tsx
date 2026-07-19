import type { CustomerLifecycleStage } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";

const STAGE_LABEL: Record<CustomerLifecycleStage, string> = {
  prospect: "Prospect",
  first_purchase: "First purchase",
  returning: "Returning",
  vip: "VIP",
  lapsed: "Lapsed",
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
