"use client";

import { useState } from "react";

import type { BookableBranch } from "./booking-flow";
import { BookingFlow } from "./booking-flow";

export function BookAppointmentLauncher({
  retailerId,
  branches,
}: {
  retailerId: string;
  branches: readonly BookableBranch[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="customer-button"
      >
        Book appointment
      </button>
    );
  }

  return (
    <BookingFlow
      retailerId={retailerId}
      branches={branches}
      onCloseAction={() => setOpen(false)}
    />
  );
}
