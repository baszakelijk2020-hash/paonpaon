"use client";

import { useState, useTransition } from "react";

import { SilhouetteCarousel } from "./silhouette-carousel";
import { VoiceMeasurementSlider } from "./voice-measurement-slider";

export function FitToolPanel({
  recordObservation,
}: {
  recordObservation: (
    area: string,
    observation: string,
  ) => Promise<{ formError?: string; successMessage?: string }>;
}) {
  const [tab, setTab] = useState<"slider" | "silhouette">("slider");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply(area: string, value: string) {
    startTransition(async () => {
      const result = await recordObservation(area, value);
      setMessage(result.formError ?? result.successMessage ?? null);
      window.setTimeout(() => setMessage(null), 2500);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="tablist" aria-label="Fit tools">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "slider"}
          onClick={() => setTab("slider")}
          className={`h-9 rounded-full px-4 text-sm font-medium ${
            tab === "slider"
              ? "bg-[var(--color-stone-900)] text-white"
              : "border border-[var(--color-stone-300)] text-[var(--color-stone-600)]"
          }`}
        >
          Voice measurement
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "silhouette"}
          onClick={() => setTab("silhouette")}
          className={`h-9 rounded-full px-4 text-sm font-medium ${
            tab === "silhouette"
              ? "bg-[var(--color-stone-900)] text-white"
              : "border border-[var(--color-stone-300)] text-[var(--color-stone-600)]"
          }`}
        >
          Silhouette
        </button>
      </div>

      {tab === "slider" ? (
        <VoiceMeasurementSlider onApply={apply} />
      ) : (
        <SilhouetteCarousel onApply={apply} />
      )}

      <p
        role="status"
        aria-live="polite"
        className="h-5 text-sm text-[var(--color-stone-600)]"
      >
        {isPending ? "Saving…" : (message ?? "")}
      </p>
    </div>
  );
}
