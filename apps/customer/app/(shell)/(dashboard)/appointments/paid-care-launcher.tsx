"use client";

import type { PaidCareServiceKind } from "@paon/domain";
import { PAID_CARE_SERVICE_KIND_LABELS } from "@paon/domain";
import { type ReactNode, useEffect, useState } from "react";

import { CARE_RESUME_KEY, CareBooker } from "./care-booker";
import type { PricedOperation } from "./paid-care-flow";

/* One mark per service, in the sidebar's line weight: a hanger for
   dry-cleaning, a shoe for repair, a needle for alteration. */
const SERVICE_ICON: Record<PaidCareServiceKind, ReactNode> = {
  dry_cleaning: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.5a2 2 0 0 0-2 2c0 .9.6 1.6 1.4 1.9V9L3.6 15.8A1.6 1.6 0 0 0 4.6 18.5h14.8a1.6 1.6 0 0 0 1-2.7L12.6 9V7.4A2 2 0 0 0 12 3.5Z" />
    </svg>
  ),
  shoe_repair: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 16.5h18v1.2a1.3 1.3 0 0 1-1.3 1.3H4.3A1.3 1.3 0 0 1 3 17.7v-1.2Z" />
      <path d="M3 16.5c0-2.4 1.2-3.4 3.2-4l4.3-1.6 1.1-4.4 3.4 1.2 1 3.2c1.3.4 3.2 1.4 5 3.6" />
    </svg>
  ),
  alteration: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18.5 3.5 5.5 16.5" />
      <path d="M19.8 4.8a1.6 1.6 0 1 0-2.3-2.3l-1 1.3 2.3 2.3 1-1.3Z" />
      <path d="M5.5 16.5c-1.4 1.4-1.6 3.6-.3 4.2 1.3.6 3.1-.5 4.1-2.1" />
    </svg>
  ),
};

export function PaidCareLauncher({
  retailerId,
  operationsByService,
  isGuest,
}: {
  retailerId: string;
  operationsByService: Readonly<
    Record<PaidCareServiceKind, readonly PricedOperation[]>
  >;
  isGuest: boolean;
}) {
  const [active, setActive] = useState<PaidCareServiceKind | null>(null);
  // A card being closed keeps its booker mounted until the fold has shut,
  // so the content slides away with it instead of vanishing first.
  const [closing, setClosing] = useState<PaidCareServiceKind | null>(null);

  // Back from signing in mid-booking: reopen the service where it was.
  useEffect(() => {
    try {
      const resume = window.sessionStorage.getItem(CARE_RESUME_KEY);
      if (
        resume === "dry_cleaning" ||
        resume === "shoe_repair" ||
        resume === "alteration"
      ) {
        window.sessionStorage.removeItem(CARE_RESUME_KEY);
        setActive(resume);
      }
    } catch {
      // Nothing to resume.
    }
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setClosing(null), 520);
    return () => window.clearTimeout(timer);
  }, [closing]);

  const toggle = (kind: PaidCareServiceKind) => {
    if (active === kind) {
      setClosing(kind);
      setActive(null);
    } else {
      if (active) setClosing(active);
      setActive(kind);
    }
  };

  return (
    <div
      className="pe-care-grid grid gap-3 sm:grid-cols-3"
      data-expanded={active || closing ? "true" : undefined}
    >
      {(["dry_cleaning", "shoe_repair", "alteration"] as const).map((kind) => {
        const isOpen = active === kind;
        const mounted = isOpen || closing === kind;
        return (
          // The card itself is the drawer: its label row keeps its place and
          // height, and the fold opens downwards under it to one fixed height.
          <div
            key={kind}
            className="pe-care-service pe-care-service-card"
            data-open={isOpen || undefined}
            data-closing={closing === kind || undefined}
          >
            <button
              type="button"
              onClick={() => toggle(kind)}
              className="pe-care-service-trigger"
              aria-expanded={isOpen}
            >
              <span className="pe-care-service-icon" aria-hidden="true">
                {SERVICE_ICON[kind]}
              </span>
              <span className="pe-care-service-label">
                {PAID_CARE_SERVICE_KIND_LABELS[kind]}
              </span>
            </button>
            <div className="pe-care-service-drawer" inert={!isOpen}>
              <div className="pe-care-service-drawer-inner">
                {mounted ? (
                  <CareBooker
                    retailerId={retailerId}
                    serviceKind={kind}
                    operations={operationsByService[kind]}
                    isGuest={isGuest}
                  />
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
