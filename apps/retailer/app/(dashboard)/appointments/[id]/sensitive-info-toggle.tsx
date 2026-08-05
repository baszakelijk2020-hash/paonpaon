"use client";

import { Button } from "@paon/ui/components/Button";
import { useState } from "react";

/**
 * PHASE 17.3: a show/hide toggle for information an advisor should not
 * have on-screen by default while the customer is standing in front of
 * them (contact details, private team notes) — distinct from
 * `AdvisorPreparationBriefCard`'s consent-driven visibility, which is
 * about compliance, not in-person screen discipline. Defaults hidden,
 * client-only state, nothing round-trips to the server.
 */
export function SensitiveInfoToggle({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
          {label}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "Show"}
        </Button>
      </div>
      {visible ? (
        children
      ) : (
        <p className="mt-1 text-sm text-[var(--color-stone-400)]">
          Hidden — tap Show only when the customer isn&rsquo;t reading the
          screen.
        </p>
      )}
    </div>
  );
}
