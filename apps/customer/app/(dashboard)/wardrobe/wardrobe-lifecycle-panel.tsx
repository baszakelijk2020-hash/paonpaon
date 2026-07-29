"use client";

import {
  WARDROBE_LIFECYCLE_EVENT_KINDS,
  WARDROBE_FIT_PERCEPTIONS,
  type FitFreshnessProjection,
  type WardrobeGuidanceItem,
  type WardrobeItem,
  type WardrobeSelfReport,
  isSelfScanEligible,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  dismissWardrobeGuidance,
  logWardrobeLifecycleEvent,
  submitWardrobeSelfScan,
  type WardrobeActionState,
} from "./actions";

type SelfReportWithUrl = {
  readonly report: WardrobeSelfReport;
  readonly signedUrl?: string;
};

export function WardrobeItemLifecyclePanel({
  retailerId,
  retailerSlug,
  item,
  guidance,
  fitFreshness,
  selfReports,
  orderStatus,
}: {
  retailerId: string;
  retailerSlug: string;
  item: WardrobeItem;
  guidance: readonly WardrobeGuidanceItem[];
  fitFreshness: FitFreshnessProjection;
  selfReports: readonly SelfReportWithUrl[];
  orderStatus?: string | null;
}) {
  const initialState: WardrobeActionState = { fieldErrors: {} };
  const [scanState, scanAction, scanPending] = useActionState(
    submitWardrobeSelfScan,
    initialState,
  );
  const [lifecycleState, lifecycleAction, lifecyclePending] = useActionState(
    logWardrobeLifecycleEvent,
    initialState,
  );
  const [dismissState, dismissAction, dismissPending] = useActionState(
    dismissWardrobeGuidance,
    initialState,
  );

  const eligibility = isSelfScanEligible({
    item,
    customerId: item.customerId,
    orderStatus:
      orderStatus && typeof orderStatus === "string"
        ? (orderStatus as never)
        : null,
  });

  const fit = fitFreshness;
  const appointmentHref = `/r/${retailerSlug}/appointments?intent=fitting&wardrobeItem=${item.id}`;

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-100)] bg-[var(--color-stone-50)] p-3">
      <div>
        <p className="text-xs font-medium text-[var(--color-stone-800)]">
          Official fit freshness
        </p>
        <p className="text-xs text-[var(--color-stone-600)]">{fit.label}</p>
        <p className="mt-1 text-xs text-[var(--color-stone-500)]">
          {fit.explanation}
        </p>
        {fit.suggestedAction !== "none" ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={appointmentHref}
              className="text-xs font-medium text-[var(--color-stone-800)] underline"
            >
              Book fit update
            </a>
            {fit.suggestedAction === "discuss_alteration" ? (
              <a
                href={`/alterations?retailer=${retailerId}`}
                className="text-xs font-medium text-[var(--color-stone-800)] underline"
              >
                Discuss alterations
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      {guidance.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="Lifecycle guidance">
          {guidance.map((guidanceItem) => (
            <li
              key={guidanceItem.key}
              className="rounded-[var(--radius-sm)] bg-white px-3 py-2 text-xs"
            >
              <p className="font-medium text-[var(--color-stone-800)]">
                {guidanceItem.title}
              </p>
              <p className="mt-1 text-[var(--color-stone-600)]">
                {guidanceItem.explanation}
              </p>
              <form action={dismissAction} className="mt-2">
                <input type="hidden" name="retailerId" value={retailerId} />
                <input type="hidden" name="wardrobeItemId" value={item.id} />
                <input
                  type="hidden"
                  name="guidanceKey"
                  value={guidanceItem.key}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={dismissPending}
                >
                  Dismiss
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      {dismissState.success ? (
        <p role="status" className="text-xs text-[var(--color-success-500)]">
          Guidance dismissed.
        </p>
      ) : null}

      <form action={lifecycleAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="retailerId" value={retailerId} />
        <input type="hidden" name="wardrobeItemId" value={item.id} />
        <label className="flex flex-col gap-1 text-xs">
          <span>Log lifecycle</span>
          <select
            name="eventKind"
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-1"
            defaultValue="cleaned"
          >
            {WARDROBE_LIFECYCLE_EVENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={lifecyclePending}
        >
          {lifecyclePending ? "Saving…" : "Log event"}
        </Button>
      </form>
      {lifecycleState.success ? (
        <p role="status" className="text-xs text-[var(--color-success-500)]">
          Lifecycle event recorded.
        </p>
      ) : null}

      {eligibility.eligible ? (
        <form
          action={scanAction}
          encType="multipart/form-data"
          className="flex flex-col gap-2 border-t border-[var(--color-stone-200)] pt-3"
          aria-label={`Self-scan for ${item.displayName}`}
        >
          <input type="hidden" name="retailerId" value={retailerId} />
          <input type="hidden" name="wardrobeItemId" value={item.id} />
          <p className="text-xs font-medium text-[var(--color-stone-800)]">
            Self-scan (self-reported only)
          </p>
          <p className="text-xs text-[var(--color-stone-500)]">
            Photos and notes stay private to this house and never become
            official measurements.
          </p>
          <label className="flex flex-col gap-1 text-xs">
            <span>Notes</span>
            <textarea
              name="notes"
              rows={2}
              maxLength={2000}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span>How it feels now</span>
            <select
              name="fitPerception"
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-2 py-1"
              defaultValue=""
            >
              <option value="">No change</option>
              {WARDROBE_FIT_PERCEPTIONS.map((state) => (
                <option key={state} value={state}>
                  {state.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span>Photo (optional)</span>
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
            />
          </label>
          <Button type="submit" size="sm" disabled={scanPending}>
            {scanPending ? "Submitting…" : "Submit self-scan"}
          </Button>
          {scanState.formError ? (
            <p role="alert" className="text-xs text-[var(--color-danger-500)]">
              {scanState.formError}
            </p>
          ) : null}
          {scanState.success ? (
            <p
              role="status"
              className="text-xs text-[var(--color-success-500)]"
            >
              Self-scan saved for your advisor.
            </p>
          ) : null}
        </form>
      ) : (
        <p className="text-xs text-[var(--color-stone-500)]">
          Self-scan opens once a house purchase is fulfilled or linked to a
          fitting garment.
        </p>
      )}

      {selfReports.length > 0 ? (
        <details className="text-xs text-[var(--color-stone-600)]">
          <summary className="cursor-pointer">
            Your self-reports ({selfReports.length})
          </summary>
          <ul className="mt-2 space-y-2 pl-3">
            {selfReports.map(({ report, signedUrl }) => (
              <li key={report.id}>
                <span className="font-medium">Self-reported · </span>
                {new Date(report.reportedAt).toLocaleDateString()}
                {report.notes ? ` — ${report.notes}` : ""}
                {signedUrl ? (
                  <a
                    href={signedUrl}
                    className="ml-2 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View photo
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
