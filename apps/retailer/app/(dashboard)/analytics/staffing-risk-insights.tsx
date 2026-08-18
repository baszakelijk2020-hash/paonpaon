"use client";

import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { recomputeStaffingRisk, type AnalyticsActionState } from "./actions";
import { type CitedInsightRow } from "./insights";

const initial: AnalyticsActionState = {};

const CONFIDENCE_LABEL: Record<string, string> = {
  insufficient_sample: "Insufficient sample",
  indicative: "Indicative",
  supported: "Supported",
};

const CONFIDENCE_TONE: Record<string, "neutral" | "warning" | "success"> = {
  insufficient_sample: "neutral",
  indicative: "warning",
  supported: "success",
};

/**
 * The `staffing_risk` card. Every row shown is a cited recommendation —
 * confidence banded rather than a fabricated percentage, sample size named
 * outright — so a sparse shop's data reads as sparse, not as false
 * confidence. Recompute is explicit and on demand, not a silent background
 * job, so a manager always knows exactly when a claim was last checked.
 */
export function StaffingRiskCard({
  insights,
}: {
  readonly insights: readonly CitedInsightRow[];
}) {
  const [state, action, pending] = useActionState(
    recomputeStaffingRisk,
    initial,
  );

  return (
    <div className="flex flex-col gap-3" data-cited-insights="staffing_risk">
      {insights.length === 0 ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          No cited finding yet. Recompute once there are appointments and a
          staff roster to compare.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {insights.map((insight) => (
            <li
              key={insight.id}
              data-cited-insight={insight.id}
              data-confidence={insight.confidence}
              className="flex flex-col gap-1 border-b border-[var(--color-stone-200)] pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex items-center gap-2">
                <Badge tone={CONFIDENCE_TONE[insight.confidence] ?? "neutral"}>
                  {CONFIDENCE_LABEL[insight.confidence] ?? insight.confidence}
                </Badge>
                <span className="text-xs text-[var(--color-stone-500)]">
                  n={insight.sampleSize}
                </span>
              </div>
              <p className="text-sm text-[var(--color-stone-900)]">
                {insight.statement}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="flex items-center gap-3">
        <Button type="submit" disabled={pending} id="recompute-staffing-risk">
          Recompute
        </Button>
        {state.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}
        {state.notice ? (
          <p role="status" className="text-sm text-[var(--color-stone-500)]">
            {state.notice}
          </p>
        ) : null}
      </form>
    </div>
  );
}
