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
  children,
  className,
  style,
}: {
  retailerId: string;
  branches: readonly BookableBranch[];
  initialReason?: AppointmentReason;
  purpose?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const bookingContext = {
    ...(initialReason ? { initialReason } : {}),
    ...(purpose ? { purpose } : {}),
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
