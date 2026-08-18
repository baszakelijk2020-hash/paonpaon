import type { MessageAttachmentScanStatus } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";

import { releaseAttachment, retryAttachment } from "./actions";

const SCAN_STATUS_LABELS: Record<
  Exclude<MessageAttachmentScanStatus, "cleared">,
  string
> = {
  pending_scan: "Pending scan",
  quarantined: "Quarantined",
  failed: "Scan failed",
};

/** The retry/release surface for an upload that isn't cleared yet — built
 * regardless of which scanner provider is eventually chosen (PHASE.md
 * execution queue item 5). Release is a deliberate, attributable human
 * review action, never an automated clear. */
export function AttachmentReviewControls({
  attachmentId,
  scanStatus,
}: {
  readonly attachmentId: string;
  readonly scanStatus: Exclude<MessageAttachmentScanStatus, "cleared">;
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <Badge tone="warning">{SCAN_STATUS_LABELS[scanStatus]}</Badge>
      {scanStatus === "failed" ? (
        <form action={retryAttachment}>
          <input type="hidden" name="attachmentId" value={attachmentId} />
          <Button type="submit" size="sm" variant="outline">
            Retry
          </Button>
        </form>
      ) : null}
      <form action={releaseAttachment}>
        <input type="hidden" name="attachmentId" value={attachmentId} />
        <Button type="submit" size="sm" variant="outline">
          Release
        </Button>
      </form>
    </div>
  );
}
