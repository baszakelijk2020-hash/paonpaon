"use client";

import type { PaidCareServiceKind } from "@paon/domain";
import { PAID_CARE_SERVICE_KIND_LABELS } from "@paon/domain";
import { type ReactNode, useState } from "react";

import { PaidCareFlow, type PricedOperation } from "./paid-care-flow";

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
}: {
  retailerId: string;
  operationsByService: Readonly<
    Record<PaidCareServiceKind, readonly PricedOperation[]>
  >;
}) {
  const [active, setActive] = useState<PaidCareServiceKind | null>(null);

  if (active) {
    return (
      <PaidCareFlow
        retailerId={retailerId}
        serviceKind={active}
        operations={operationsByService[active]}
        onCloseAction={() => setActive(null)}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {(["dry_cleaning", "shoe_repair", "alteration"] as const).map((kind) => (
        <button
          key={kind}
          type="button"
          onClick={() => setActive(kind)}
          className="pe-care-service"
        >
          <span className="pe-care-service-icon" aria-hidden="true">
            {SERVICE_ICON[kind]}
          </span>
          <span className="pe-care-service-label">
            {PAID_CARE_SERVICE_KIND_LABELS[kind]}
          </span>
        </button>
      ))}
    </div>
  );
}
