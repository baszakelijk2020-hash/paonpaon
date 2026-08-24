"use client";

import type { WardrobeItemServiceView } from "@paon/database";
import {
  WARDROBE_FIT_PERCEPTIONS,
  WARDROBE_LIFECYCLE_EVENT_KINDS,
  fitFreshnessLabel,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  dismissLongevityGuidance,
  recordWardrobeLifecycleEvent,
  submitWardrobeSelfScan,
  type LifecycleActionState,
} from "./lifecycle-actions";

const LIFECYCLE_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
  year: "numeric",
});

function formatLifecycleDate(value: string): string {
  return LIFECYCLE_DATE_FORMATTER.format(new Date(value));
}

function defaultAppointmentWindow(): {
  startsAt: string;
  endsAt: string;
} {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 3);
  start.setUTCHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}

export function WardrobeLifecyclePanel({
  views,
}: {
  views: readonly WardrobeItemServiceView[];
}) {
  const initialState: LifecycleActionState = { fieldErrors: {} };
  const [lifecycleState, lifecycleAction, lifecyclePending] = useActionState(
    recordWardrobeLifecycleEvent,
    initialState,
  );
  const [scanState, scanAction, scanPending] = useActionState(
    submitWardrobeSelfScan,
    initialState,
  );
  const [dismissState, dismissAction, dismissPending] = useActionState(
    dismissLongevityGuidance,
    initialState,
  );

  const appointmentWindow = defaultAppointmentWindow();
  const activeViews = views.filter((view) => view.item.condition !== "retired");

  if (activeViews.length === 0) {
    return null;
  }

  return (
    <section
      className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-5"
      aria-labelledby="wardrobe-lifecycle-heading"
    >
      <div>
        <h2
          id="wardrobe-lifecycle-heading"
          className="text-lg font-medium text-[var(--color-stone-900)]"
        >
          Lifecycle, fit freshness, and self-scan
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Care and rotation guidance stays dismissible. Self-scan photos and
          notes are private and never become official fitting measurements.
        </p>
      </div>

      {lifecycleState.formError ||
      scanState.formError ||
      dismissState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {lifecycleState.formError ??
            scanState.formError ??
            dismissState.formError}
        </p>
      ) : null}
      {lifecycleState.success || scanState.success || dismissState.success ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Wardrobe service update saved.
        </p>
      ) : null}

      <ul className="divide-y divide-[var(--color-stone-100)]">
        {activeViews.map((view) => (
          <li
            key={view.item.id}
            className="flex flex-col gap-4 py-4 first:pt-0"
          >
            <div>
              <p className="text-sm font-medium text-[var(--color-stone-900)]">
                {view.item.brand ? `${view.item.brand} · ` : ""}
                {view.item.displayName}
              </p>
              <p className="text-xs text-[var(--color-stone-500)]">
                {fitFreshnessLabel(view.fitFreshness.status)}
                {view.fitFreshness.lastOfficialMeasuredAt
                  ? ` · last measured ${formatLifecycleDate(view.fitFreshness.lastOfficialMeasuredAt)}`
                  : " · no official measurement yet"}
                {view.fitFreshness.selfReportedFitPerception
                  ? ` · self-reported fit ${view.fitFreshness.selfReportedFitPerception.replaceAll("_", " ")}`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-[var(--color-stone-600)]">
                {view.fitFreshness.explanation}
              </p>
            </div>

            {view.longevityGuidance.length > 0 ? (
              <ul className="space-y-2" aria-label="Longevity guidance">
                {view.longevityGuidance.map((guidance) => (
                  <li
                    key={guidance.kind}
                    className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-stone-900)]">
                          {guidance.title}
                        </p>
                        <p className="text-xs text-[var(--color-stone-600)]">
                          {guidance.message}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                          {guidance.explanation}
                        </p>
                      </div>
                      <form action={dismissAction}>
                        <input
                          type="hidden"
                          name="wardrobeItemId"
                          value={view.item.id}
                        />
                        <input
                          type="hidden"
                          name="guidanceKind"
                          value={guidance.kind}
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
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            <form
              action={lifecycleAction}
              className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
              aria-label={`Record lifecycle event for ${view.item.displayName}`}
            >
              <input type="hidden" name="wardrobeItemId" value={view.item.id} />
              <label className="flex flex-col gap-1 text-sm">
                <span>Log wear / rest / care</span>
                <select
                  name="eventKind"
                  className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
                  defaultValue="worn"
                >
                  {WARDROBE_LIFECYCLE_EVENT_KINDS.filter(
                    (kind) => kind !== "guidance_dismissed",
                  ).map((kind) => (
                    <option key={kind} value={kind}>
                      {kind.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="sm" disabled={lifecyclePending}>
                {lifecyclePending ? "Saving…" : "Log event"}
              </Button>
            </form>

            {view.selfScanEligible ? (
              <form
                action={scanAction}
                className="flex flex-col gap-3 border-t border-[var(--color-stone-100)] pt-3"
                aria-label={`Self-scan for ${view.item.displayName}`}
              >
                <input
                  type="hidden"
                  name="wardrobeItemId"
                  value={view.item.id}
                />
                <input
                  type="hidden"
                  name="appointmentStartsAt"
                  value={appointmentWindow.startsAt}
                />
                <input
                  type="hidden"
                  name="appointmentEndsAt"
                  value={appointmentWindow.endsAt}
                />
                <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                  Self-scan
                </h3>
                <p className="text-xs text-[var(--color-stone-500)]">
                  Upload a current-wear photo and notes. Advisors see this as
                  self-reported context only. Requesting service books a
                  fit-update or alteration fitting appointment.
                </p>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Photo (private)</span>
                  <input
                    type="file"
                    name="photo"
                    accept="image/jpeg,image/png,image/webp"
                    className="text-sm"
                    aria-invalid={!!scanState.fieldErrors.photo}
                  />
                  {scanState.fieldErrors.photo ? (
                    <span className="text-xs text-[var(--color-danger-500)]">
                      {scanState.fieldErrors.photo}
                    </span>
                  ) : null}
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Notes</span>
                  <textarea
                    name="notes"
                    maxLength={2000}
                    rows={2}
                    className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Perceived fit</span>
                    <select
                      name="fitPerceptionAtScan"
                      className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
                      defaultValue={view.item.fitPerception}
                    >
                      {WARDROBE_FIT_PERCEPTIONS.map((state) => (
                        <option key={state} value={state}>
                          {state.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="sizeChangeReported" />
                    <span>Possible size change</span>
                  </label>
                </div>
                {view.fitFreshness.recommendedAppointmentType ? (
                  <input
                    type="hidden"
                    name="preferredAppointmentType"
                    value={
                      view.item.fitPerception === "needs_alteration" ||
                      view.item.fitPerception === "slightly_tight" ||
                      view.item.fitPerception === "slightly_loose"
                        ? "alteration_fitting"
                        : view.fitFreshness.recommendedAppointmentType
                    }
                  />
                ) : null}
                <Button type="submit" disabled={scanPending}>
                  {scanPending
                    ? "Submitting…"
                    : "Submit self-scan and request service"}
                </Button>
              </form>
            ) : (
              <p className="text-xs text-[var(--color-stone-500)]">
                Self-scan is available for house purchases or garments linked to
                an order line / fitting garment.
              </p>
            )}

            {view.selfScans.length > 0 ? (
              <details className="text-xs text-[var(--color-stone-500)]">
                <summary className="cursor-pointer">
                  Self-scan history ({view.selfScans.length})
                </summary>
                <ul className="mt-2 space-y-1 pl-3">
                  {view.selfScans.map((scan) => (
                    <li key={scan.id}>
                      {formatLifecycleDate(scan.createdAt)} ·{" "}
                      {scan.provenance.replaceAll("_", " ")} · handoff{" "}
                      {scan.serviceHandoffKind.replaceAll("_", " ")}
                      {scan.notes ? ` · ${scan.notes}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {view.lifecycleEvents.length > 0 ? (
              <details className="text-xs text-[var(--color-stone-500)]">
                <summary className="cursor-pointer">
                  Lifecycle history ({view.lifecycleEvents.length})
                </summary>
                <ul className="mt-2 space-y-1 pl-3">
                  {view.lifecycleEvents.map((event) => (
                    <li key={event.id}>
                      {event.eventKind.replaceAll("_", " ")} ·{" "}
                      {formatLifecycleDate(event.occurredAt)}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
