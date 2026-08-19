import type { SilhouetteAnalysisCaptureWithUrl } from "@paon/database";
import type { SilhouetteAnalysisSession } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import { SilhouetteAnalysisDecision } from "./silhouette-analysis-decision";

const STATUS_LABELS: Record<SilhouetteAnalysisSession["status"], string> = {
  consented: "Awaiting photo",
  capturing: "Awaiting photo",
  candidate: "Awaiting your review",
  advisor_reviewed: "Approved — awaiting client confirmation",
  customer_confirmed: "Confirmed",
  rejected: "Not proceeding",
  expired: "Expired",
};

/** FT-02's advisor review step (docs/FOUNDER_TOOL_BLUEPRINTS.md) — the
 * human decision the blueprint requires before a candidate can ever
 * reach the client's own confirmation. Never touches any approved-fit/
 * measurement record; this only records a reviewed opinion. */
export function SilhouetteAnalysisCard({
  customerId,
  sessions,
  capturesBySessionId,
}: {
  customerId: string;
  sessions: readonly SilhouetteAnalysisSession[];
  capturesBySessionId: ReadonlyMap<
    string,
    readonly SilhouetteAnalysisCaptureWithUrl[]
  >;
}) {
  if (sessions.length === 0) return null;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Silhouette analysis
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Photos the client sent for your review before their fitting.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {sessions.map((session) => {
          const captures = capturesBySessionId.get(session.id) ?? [];
          return (
            <li
              key={session.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {STATUS_LABELS[session.status]}
                </p>
                <p className="text-xs text-[var(--color-stone-500)]">
                  {formatDate(session.createdAt, "en-US")}
                </p>
              </div>
              {captures.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {captures.map(({ capture, signedUrl }) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={capture.id}
                      src={signedUrl}
                      alt="Client submission"
                      className="max-h-40 rounded-[var(--radius-md)] border border-[var(--color-stone-200)]"
                    />
                  ))}
                </div>
              ) : null}
              {session.status === "candidate" ? (
                <SilhouetteAnalysisDecision
                  customerId={customerId}
                  sessionId={session.id}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
