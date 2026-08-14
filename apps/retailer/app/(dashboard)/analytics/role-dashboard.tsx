"use client";

import type { DashboardSection } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";

const RECOMMENDATION_KIND_LABELS: Record<string, string> = {
  temporal_hotspot: "Busiest appointment slot",
  interest_progression: "Interest progression",
  complete_look: "Complete look",
  fit_risk: "Fit risk",
  production_risk: "Production risk",
  stock_risk: "Stock risk",
  staffing_risk: "Staffing risk",
  corporate_renewal_risk: "Corporate renewal risk",
};

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
 * Renders grouped recommendations organized by kind. Each kind that has
 * recommendations is displayed as its own section. Empty sections are
 * filtered out by `buildRoleDashboard`, so only kinds with actual data appear.
 */
export function RoleDashboardCard({
  sections,
}: {
  readonly sections: readonly DashboardSection[];
}) {
  return (
    <div className="flex flex-col gap-6" data-role-dashboard>
      {sections.length === 0 ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          No cited findings yet. Once projectors run and build recommendations,
          they will appear here grouped by finding type.
        </p>
      ) : (
        sections.map((section) => (
          <div
            key={section.kind}
            className="flex flex-col gap-3"
            data-dashboard-section={section.kind}
          >
            <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
              {RECOMMENDATION_KIND_LABELS[section.kind] ?? section.kind}
            </h3>
            <ul className="flex flex-col gap-3">
              {section.recommendations.map((recommendation) => (
                <li
                  key={`${recommendation.kind}-${recommendation.derivedFromFactIds.join(
                    "-",
                  )}`}
                  data-recommendation-kind={recommendation.kind}
                  data-confidence={recommendation.confidence}
                  className="flex flex-col gap-2 rounded border border-[var(--color-stone-100)] p-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        CONFIDENCE_TONE[recommendation.confidence] ?? "neutral"
                      }
                    >
                      {CONFIDENCE_LABEL[recommendation.confidence] ??
                        recommendation.confidence}
                    </Badge>
                    <span className="text-xs text-[var(--color-stone-500)]">
                      n={recommendation.sampleSize}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-stone-900)]">
                    {recommendation.statement}
                  </p>
                  <div className="mt-1 flex flex-col gap-1 text-xs text-[var(--color-stone-400)]">
                    <p>
                      Window:{" "}
                      {new Date(
                        recommendation.window.from,
                      ).toLocaleDateString()}{" "}
                      to{" "}
                      {new Date(recommendation.window.to).toLocaleDateString()}
                    </p>
                    {recommendation.sources.length > 0 && (
                      <p>
                        {recommendation.sources.length === 1
                          ? `${recommendation.sources[0]?.sourceRef} (v${recommendation.sources[0]?.projectorVersion})`
                          : `${recommendation.sources.length} sources`}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
