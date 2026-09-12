"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

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
  initialMonth,
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
  /** Month the calendar opens on — ISO `YYYY-MM`, serialisable from a server
   * component. Seasonal cards pass theirs. */
  initialMonth?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(autoOpen ?? false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open)
      dialog.current.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  const bookingContext = {
    ...(initialReason ? { initialReason } : {}),
    ...(purpose ? { purpose } : {}),
    ...(wardrobeItemId ? { wardrobeItemId } : {}),
    ...(roadmapGapId ? { roadmapGapId } : {}),
    ...(initialMonth
      ? {
          initialMonth: new Date(
            Number(initialMonth.slice(0, 4)),
            Number(initialMonth.slice(5, 7)) - 1,
            1,
          ),
        }
      : {}),
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "customer-button"}
        style={style}
      >
        {children ?? "Book appointment"}
      </button>
      <dialog
        ref={dialog}
        className="pe-booking-dialog"
        aria-label="Book an appointment"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      >
        {open ? (
          <BookingFlow
            retailerId={retailerId}
            branches={branches}
            {...bookingContext}
            onCloseAction={() => setOpen(false)}
          />
        ) : null}
      </dialog>
    </>
  );
}
