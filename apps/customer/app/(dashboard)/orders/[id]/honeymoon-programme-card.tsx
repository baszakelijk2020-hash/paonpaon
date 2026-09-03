import type { HoneymoonProgrammeRecord } from "@paon/database";
import { HoneymoonProgrammeCard as SharedHoneymoonProgrammeCard } from "@paon/ui/components/HoneymoonProgrammeCard";

export function HoneymoonProgrammeCard({
  programme,
}: {
  readonly programme: HoneymoonProgrammeRecord;
}) {
  return (
    <SharedHoneymoonProgrammeCard
      orderId={programme.orderId}
      payAtDelivery={programme.payAtDelivery}
      actions={programme.actions}
      showLookPlanLink
    />
  );
}
