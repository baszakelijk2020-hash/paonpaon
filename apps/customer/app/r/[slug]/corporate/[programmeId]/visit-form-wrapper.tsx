"use client";

import { useState } from "react";

import { BookingForm } from "./booking-form";
import { OfficeVisitRequestForm } from "./request-form";

interface VisitFormWrapperProps {
  programmeId: string;
}

/**
 * Wrapper that offers both booking paths: the new direct booking form
 * (with slot availability) and the fallback lead-only request form.
 */
export function VisitFormWrapper({ programmeId }: VisitFormWrapperProps) {
  const [showRequestForm, setShowRequestForm] = useState(false);

  if (showRequestForm) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--color-stone-600)]">
          Preferred times not available? Submit a request and someone will be in
          touch shortly.
        </p>
        <OfficeVisitRequestForm programmeId={programmeId} />
      </div>
    );
  }

  return (
    <BookingForm
      programmeId={programmeId}
      fallbackToRequest={() => setShowRequestForm(true)}
    />
  );
}
