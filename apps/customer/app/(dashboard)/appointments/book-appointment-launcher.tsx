"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import type { BookableBranch } from "./booking-flow";
import { BookingFlow } from "./booking-flow";
import type { AppointmentReason } from "./booking-reasons";

export function BookAppointmentLauncher({
  retailerId,
  branches,
  initialReason,
  purpose,
  wardrobeItemId,
  roadmapGapId,
  autoOpen,
  children,
  className,
  style,
}: {
  retailerId: string;
  branches: readonly BookableBranch[];
  initialReason?: AppointmentReason;
  purpose?: string;
  wardrobeItemId?: string;
  roadmapGapId?: string;
  /** Opens the real booking flow immediately, skipping the closed-button
   * gate — used only when a server-verified Wardrobe prefill context
   * resolved successfully (DeepSeek remediation Cards 1-2). */
  autoOpen?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(autoOpen ?? false);
  const bookingContext = {
    ...(initialReason ? { initialReason } : {}),
    ...(purpose ? { purpose } : {}),
    ...(wardrobeItemId ? { wardrobeItemId } : {}),
    ...(roadmapGapId ? { roadmapGapId } : {}),
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "customer-button"}
        style={style}
      >
        {children ?? "Book appointment"}
      </button>
    );
  }

  return (
    <BookingFlow
      retailerId={retailerId}
      branches={branches}
      {...bookingContext}
      onCloseAction={() => setOpen(false)}
    />
  );
}
