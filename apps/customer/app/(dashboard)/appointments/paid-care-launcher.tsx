"use client";

import type { PaidCareServiceKind } from "@paon/domain";
import { PAID_CARE_SERVICE_KIND_LABELS } from "@paon/domain";
import { useState } from "react";

import { PaidCareFlow, type PricedOperation } from "./paid-care-flow";

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
          className="rounded-[15px] bg-gradient-to-br from-[var(--color-stone-900)] to-[var(--color-stone-800)] px-4 py-5 text-left text-white"
        >
          <p className="font-display text-base">
            {PAID_CARE_SERVICE_KIND_LABELS[kind]}
          </p>
        </button>
      ))}
    </div>
  );
}
