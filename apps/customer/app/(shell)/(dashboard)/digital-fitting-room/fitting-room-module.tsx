"use client";

import type {
  FitArchetypeOption,
  Outfit,
  StylePortrait,
  StylePortraitConsent,
  WardrobeVisualizationJob,
} from "@paon/domain";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import "./fitting-room-module.css";
import {
  derivePortraitStep,
  FittingPortraitCard,
} from "./fitting-portrait-card";
import type { ComposableItem, SaveableProduct } from "./fitting-room-types";
import { FittingStageCard, type StageGate } from "./fitting-stage-card";
import { FittingTrayCard } from "./fitting-tray-card";

const POLL_INTERVAL_MS = 5000;

function isActive(job: WardrobeVisualizationJob | null | undefined): boolean {
  return job?.status === "queued" || job?.status === "generating";
}

export interface FittingRoomModuleProps {
  retailerId: string;
  retailerName: string;
  composableItems: readonly ComposableItem[];
  outfits: readonly Outfit[];
  latestJobByOutfitId: Readonly<Record<string, WardrobeVisualizationJob>>;
  canGenerate: boolean;
  consent: StylePortraitConsent;
  portrait: StylePortrait | null;
  portraitPreviewJob: WardrobeVisualizationJob | null;
  fitArchetypes: readonly FitArchetypeOption[];
  preloadKey?: string | undefined;
  /** Catalogue pieces the customer can still save from the tray card. */
  favorites?: readonly SaveableProduct[] | undefined;
  /** Signed thumbnail URL per portrait reference id. */
  referencePreviews?: Readonly<Record<string, string>> | undefined;
}

/**
 * The whole Digital Fitting Room as one dark workspace card inside /wardrobe:
 * "You" (consent, three photos, fit, one next action), the "Try on" stage and
 * the "Saved pieces" tray. Nothing here links to another route.
 */
export function FittingRoomModule({
  retailerId,
  retailerName,
  composableItems,
  outfits,
  latestJobByOutfitId,
  canGenerate,
  consent,
  portrait,
  portraitPreviewJob,
  fitArchetypes,
  preloadKey,
  favorites = [],
  referencePreviews = {},
}: FittingRoomModuleProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(preloadKey ? [preloadKey] : []),
  );

  const anyActive =
    isActive(portraitPreviewJob) ||
    Object.values(latestJobByOutfitId).some((job) => isActive(job));

  // Queued and generating jobs finish on the server; pick up the result.
  useEffect(() => {
    if (!anyActive) return;
    const timer = window.setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [anyActive, router]);

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const step = derivePortraitStep(consent, portrait, portraitPreviewJob);
  const gate: StageGate = canGenerate
    ? "ready"
    : step.consentGranted && portrait?.status === "approved"
      ? "needs_preset"
      : "needs_portrait";

  const fullBody = portrait?.references.find((ref) => ref.kind === "full_body");
  const baseImageUrl =
    portraitPreviewJob?.outputImageUrl ??
    portrait?.previewImageUrl ??
    (fullBody ? referencePreviews[fullBody.id] : undefined);

  return (
    <section
      className="paon-fit"
      data-fitting-module
      aria-labelledby={`fitting-room-title-${retailerId}`}
    >
      <header className="paon-fit-head">
        <h2 id={`fitting-room-title-${retailerId}`} className="paon-fit-title">
          Fitting room
        </h2>
        <span className="paon-fit-retailer">{retailerName}</span>
      </header>
      <div className="paon-fit-grid">
        <FittingPortraitCard
          retailerId={retailerId}
          retailerName={retailerName}
          consent={consent}
          portrait={portrait}
          previewJob={portraitPreviewJob}
          fitArchetypes={fitArchetypes}
          referencePreviews={referencePreviews}
        />
        <FittingStageCard
          retailerId={retailerId}
          items={composableItems}
          outfits={outfits}
          latestJobByOutfitId={latestJobByOutfitId}
          gate={gate}
          nextLabel={step.label}
          baseImageUrl={baseImageUrl}
          selectedKeys={selected}
          onToggle={toggle}
          onClear={() => setSelected(new Set())}
        />
        <FittingTrayCard
          retailerId={retailerId}
          items={composableItems}
          favorites={favorites}
          selectedKeys={selected}
          onToggle={toggle}
        />
      </div>
    </section>
  );
}
