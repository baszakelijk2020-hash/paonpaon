"use client";

import type { PaidCareServiceKind } from "@paon/domain";
import { useEffect, useMemo, useRef, useState } from "react";

import { GuestPortalPreview } from "../guest-portal-preview";

import { ALTERATION_PRICE_MENU } from "./alteration-price-menu";
import { createPaidCareBooking } from "./paid-care-actions";
import type { PricedOperation } from "./paid-care-flow";

type Method = "store" | "home" | "office";
type Moment = "morning" | "afternoon" | "evening";
type Payment = "pay_at_pickup" | "pay_now";

type Draft = {
  step: 0 | 1 | 2;
  quantities: Record<string, number>;
  pickup: Method | null;
  pickupMoment: Moment | null;
  returnMethod: Method | null;
  returnMoment: Moment | null;
  notes: string;
  payment: Payment;
  /** For a service without a price list: what needs doing, and how many. */
  freeText: string;
  freeQty: number;
};

const EMPTY: Draft = {
  step: 0,
  quantities: {},
  pickup: null,
  pickupMoment: null,
  returnMethod: null,
  returnMoment: null,
  notes: "",
  payment: "pay_at_pickup",
  freeText: "",
  freeQty: 1,
};

const STEP_COUNT = 3;

const PICKUP_OPTIONS: readonly { value: Method; label: string }[] = [
  { value: "store", label: "Store" },
  { value: "home", label: "Home" },
  { value: "office", label: "Office" },
];
const MOMENTS: readonly { value: Moment; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

/** How each choice reads in the summary. */
const PICKUP_SUMMARY: Record<Method, string> = {
  store: "Drop-off in store",
  home: "Pick-up from home",
  office: "Pick-up from office",
};
const RETURN_SUMMARY: Record<Method, string> = {
  store: "Collect in store",
  home: "Delivery to home",
  office: "Delivery to office",
};

const draftKey = (kind: PaidCareServiceKind) => `paon-care-draft:${kind}`;
/** Set just before signing in, so the booking reopens where it was. */
export const CARE_RESUME_KEY = "paon-care-resume";

function readDraft(kind: PaidCareServiceKind): Draft {
  try {
    const raw = window.sessionStorage.getItem(draftKey(kind));
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function formatMoney(amountMinorUnits: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    amountMinorUnits / 100,
  );
}

/**
 * A paid-care booking inside its own card, in three steps of the same
 * height: the service and how many, then pick-up and return (method, time of
 * day, and a note for the courier), then the summary — and, for a guest, the
 * sign-in card right there. Back and forth slides like tabs, every step's
 * lines arrive staggered, nothing resizes, and nothing is lost: the answers
 * are kept for the tab's session, so a sign-in redirect comes back to the
 * same step with everything still filled in.
 *
 * Booking creates one paid-care booking per service line — the atelier's
 * paid-care page shows each with its pick-up and return, the time of day and
 * the note, and the customer's confirmation email is sent by the database
 * trigger that follows every new booking.
 */
export function CareBooker({
  retailerId,
  serviceKind,
  operations,
  isGuest,
}: {
  retailerId: string;
  serviceKind: PaidCareServiceKind;
  operations: readonly PricedOperation[];
  isGuest: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referencePhoto, setReferencePhoto] = useState<File | null>(null);
  const [done, setDone] = useState<{ totalLabel?: string; qr?: string } | null>(
    null,
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const pricedOperations =
    serviceKind === "alteration" && operations.length === 0
      ? ALTERATION_PRICE_MENU
      : operations;

  useEffect(() => {
    setDraft(readDraft(serviceKind));
    setRestored(true);
  }, [serviceKind]);

  useEffect(() => {
    if (!restored) return;
    try {
      window.sessionStorage.setItem(
        draftKey(serviceKind),
        JSON.stringify(draft),
      );
    } catch {
      // Only the convenience is lost.
    }
  }, [draft, restored, serviceKind]);

  const set = (patch: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const lines = useMemo(
    () =>
      pricedOperations
        .map((operation) => ({
          operation,
          quantity: draft.quantities[operation.code] ?? 0,
        }))
        .filter((line) => line.quantity > 0),
    [pricedOperations, draft.quantities],
  );
  const currency = pricedOperations[0]?.currency ?? "EUR";
  // No price list for this service: one described line, quoted by the
  // advisor (the booking action books it as "confirmed by advisor").
  const quoted = pricedOperations.length === 0;
  const bookLines = quoted
    ? draft.freeText.trim() && draft.freeQty > 0
      ? [
          {
            operation: {
              code: "",
              label: draft.freeText.trim().slice(0, 500),
              amountMinorUnits: 0,
              currency,
            },
            quantity: draft.freeQty,
          },
        ]
      : []
    : lines;
  const total = bookLines.reduce(
    (sum, line) => sum + line.operation.amountMinorUnits * line.quantity,
    0,
  );
  const count = bookLines.reduce((sum, line) => sum + line.quantity, 0);
  const totalLabel = quoted
    ? "Quoted by your advisor"
    : formatMoney(total, currency);

  const bump = (code: string, delta: number) =>
    setDraft((current) => {
      const next = Math.max(
        0,
        Math.min(50, (current.quantities[code] ?? 0) + delta),
      );
      return {
        ...current,
        quantities: { ...current.quantities, [code]: next },
      };
    });

  const go = (step: Draft["step"]) => {
    setError(null);
    set({ step });
    viewportRef.current?.scrollTo({ top: 0 });
  };

  const momentLabel = (value: Moment | null) =>
    MOMENTS.find((moment) => moment.value === value)?.label.toLowerCase() ?? "";

  const book = async () => {
    if (
      isGuest ||
      bookLines.length === 0 ||
      !draft.pickup ||
      !draft.pickupMoment ||
      !draft.returnMethod ||
      !draft.returnMoment ||
      busy
    )
      return;
    setBusy(true);
    setError(null);
    let qr: string | undefined;
    for (const line of bookLines) {
      const form = new FormData();
      form.set("retailerId", retailerId);
      form.set("serviceKind", serviceKind);
      form.set("garmentDescription", line.operation.label);
      form.set("quantity", String(line.quantity));
      if (line.operation.code) form.set("operationCode", line.operation.code);
      form.set("pickupMethod", draft.pickup);
      form.set("returnMethod", draft.returnMethod);
      form.set("paymentChoice", draft.payment);
      form.set(
        "preferredWindow",
        `Pick-up: ${momentLabel(draft.pickupMoment)} · Return: ${momentLabel(draft.returnMoment)}`,
      );
      if (draft.notes.trim()) form.set("notes", draft.notes.trim());
      const result = await createPaidCareBooking({ fieldErrors: {} }, form);
      if (!result.success) {
        setBusy(false);
        setError(
          result.formError ??
            Object.values(result.fieldErrors)[0] ??
            "That could not be booked.",
        );
        return;
      }
      qr ??= result.qrDataUrl;
    }
    setBusy(false);
    setDone({
      totalLabel,
      ...(qr ? { qr } : {}),
    });
    try {
      window.sessionStorage.removeItem(draftKey(serviceKind));
    } catch {
      // Nothing to clear.
    }
    setDraft(EMPTY);
  };

  const primary = done
    ? null
    : draft.step === 0
      ? {
          label: "Set pickup & delivery",
          disabled: count === 0,
          onClick: () => go(1),
        }
      : draft.step === 1
        ? {
            label: "Review booking",
            disabled:
              !draft.pickup ||
              !draft.pickupMoment ||
              !draft.returnMethod ||
              !draft.returnMoment,
            onClick: () => go(2),
          }
        : {
            label: busy ? "Booking…" : "Book",
            disabled: isGuest || busy || bookLines.length === 0,
            onClick: () => void book(),
          };

  return (
    <div className="cb" data-step={draft.step}>
      <div className="cb-head">
        <button
          type="button"
          className="cb-back"
          onClick={() => go((draft.step - 1) as Draft["step"])}
          disabled={draft.step === 0 || Boolean(done)}
          aria-label="Back"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"
            />
          </svg>
        </button>
        <span className="cb-spacer" aria-hidden="true" />
        <span
          className="cb-steps"
          aria-label={`Step ${draft.step + 1} of ${STEP_COUNT}`}
        >
          {done ? "Booked" : `${draft.step + 1} of ${STEP_COUNT}`}
        </span>
      </div>

      <div className="cb-viewport" ref={viewportRef}>
        <div
          className="cb-track"
          style={{
            transform: `translateX(${-(done ? 2 : draft.step) * 100}%)`,
          }}
        >
          {/* 1 — the service and how many */}
          <section
            className="cb-step"
            data-active={draft.step === 0 || undefined}
            inert={draft.step !== 0}
          >
            <ul className="cb-list">
              {pricedOperations.map((operation, index) => {
                const quantity = draft.quantities[operation.code] ?? 0;
                return (
                  <li
                    key={operation.code}
                    className="cb-item"
                    style={{ "--i": index } as React.CSSProperties}
                  >
                    <span className="cb-item-label">{operation.label}</span>
                    <span className="cb-item-price">
                      {formatMoney(
                        operation.amountMinorUnits,
                        operation.currency,
                      )}
                    </span>
                    <span
                      className="cb-qty"
                      data-set={quantity > 0 || undefined}
                    >
                      <button
                        type="button"
                        aria-label={`One fewer ${operation.label}`}
                        disabled={quantity === 0}
                        onClick={() => bump(operation.code, -1)}
                      >
                        −
                      </button>
                      <output aria-live="polite">{quantity}</output>
                      <button
                        type="button"
                        aria-label={`One more ${operation.label}`}
                        onClick={() => bump(operation.code, 1)}
                      >
                        +
                      </button>
                    </span>
                  </li>
                );
              })}
              {quoted ? (
                <li
                  className="cb-item cb-quoted"
                  style={{ "--i": 0 } as React.CSSProperties}
                >
                  <span className="cb-label">
                    What needs doing? Your advisor quotes the price.
                  </span>
                  <textarea
                    className="cb-notes"
                    rows={3}
                    maxLength={500}
                    value={draft.freeText}
                    placeholder="E.g. shorten trouser hems 2 cm, take in jacket waist"
                    onChange={(event) => set({ freeText: event.target.value })}
                  />
                  <span className="cb-quoted-qty">
                    <span className="cb-label">Garments</span>
                    <span className="cb-qty" data-set>
                      <button
                        type="button"
                        aria-label="One fewer garment"
                        disabled={draft.freeQty <= 1}
                        onClick={() =>
                          set({ freeQty: Math.max(1, draft.freeQty - 1) })
                        }
                      >
                        −
                      </button>
                      <output aria-live="polite">{draft.freeQty}</output>
                      <button
                        type="button"
                        aria-label="One more garment"
                        onClick={() =>
                          set({ freeQty: Math.min(50, draft.freeQty + 1) })
                        }
                      >
                        +
                      </button>
                    </span>
                  </span>
                </li>
              ) : null}
            </ul>
            <div
              className="cb-selection-total cb-item"
              style={{ "--i": operations.length + 1 } as React.CSSProperties}
            >
              <span>Total</span>
              <strong>{totalLabel}</strong>
            </div>
            {serviceKind === "alteration" ? (
              <label className="cb-photo-field cb-item">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={(event) =>
                    setReferencePhoto(event.currentTarget.files?.[0] ?? null)
                  }
                />
                <PhotoAddIcon />
                <span className="cb-photo-copy">
                  <strong>
                    {referencePhoto?.name ?? "Add reference photo"}
                  </strong>
                  <small>Optional</small>
                </span>
                <span className="cb-photo-plus" aria-hidden="true">
                  +
                </span>
              </label>
            ) : null}
          </section>

          {/* 2 — collection and delivery, designed as discrete choices. */}
          <section
            className="cb-step"
            data-active={draft.step === 1 || undefined}
            inert={draft.step !== 1}
          >
            <div
              className="cb-group cb-item"
              style={{ "--i": 0 } as React.CSSProperties}
            >
              <span className="cb-label">Pick-up</span>
              <ChoiceCards
                options={PICKUP_OPTIONS}
                value={draft.pickup}
                onChange={(pickup) => set({ pickup })}
              />
              <ChoiceCards
                options={MOMENTS}
                value={draft.pickupMoment}
                onChange={(pickupMoment) => set({ pickupMoment })}
                icon="time"
              />
            </div>
            <div
              className="cb-group cb-item"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              <span className="cb-label">Delivery</span>
              <ChoiceCards
                options={PICKUP_OPTIONS}
                value={draft.returnMethod}
                onChange={(returnMethod) => set({ returnMethod })}
              />
              <ChoiceCards
                options={MOMENTS}
                value={draft.returnMoment}
                onChange={(returnMoment) => set({ returnMoment })}
                icon="time"
              />
            </div>
          </section>

          {/* 3 — summary, and sign in right here if needed */}
          <section
            className="cb-step"
            data-active={draft.step === 2 || Boolean(done) || undefined}
            inert={draft.step !== 2 && !done}
          >
            {done ? (
              <div
                className="cb-done cb-item"
                style={{ "--i": 0 } as React.CSSProperties}
              >
                <strong>Booked · {done.totalLabel}</strong>
                <span>
                  The atelier has it, and a confirmation is on its way to your
                  email.
                </span>
                {done.qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={done.qr}
                    alt="Show this code when you collect in store"
                  />
                ) : null}
                <button
                  type="button"
                  className="cb-link"
                  onClick={() => setDone(null)}
                >
                  Book something else
                </button>
              </div>
            ) : (
              <>
                <ul className="cb-summary">
                  {bookLines.map((line, index) => (
                    <li
                      key={line.operation.code}
                      className="cb-item"
                      style={{ "--i": index } as React.CSSProperties}
                    >
                      <span>
                        {line.quantity} × {line.operation.label}
                      </span>
                      <span>
                        {quoted
                          ? "Quoted"
                          : formatMoney(
                              line.operation.amountMinorUnits * line.quantity,
                              line.operation.currency,
                            )}
                      </span>
                    </li>
                  ))}
                  <li
                    className="cb-item cb-summary-total"
                    style={{ "--i": bookLines.length } as React.CSSProperties}
                  >
                    <span>Total</span>
                    <span>{totalLabel}</span>
                  </li>
                  <li
                    className="cb-item cb-summary-meta"
                    style={
                      { "--i": bookLines.length + 1 } as React.CSSProperties
                    }
                  >
                    {PICKUP_SUMMARY[draft.pickup ?? "store"]},{" "}
                    {momentLabel(draft.pickupMoment)} ·{" "}
                    {RETURN_SUMMARY[draft.returnMethod ?? "store"]},{" "}
                    {momentLabel(draft.returnMoment)}
                  </li>
                </ul>
                <div
                  className="cb-group cb-item"
                  style={{ "--i": bookLines.length + 2 } as React.CSSProperties}
                >
                  <Segments
                    options={[
                      {
                        value: "pay_at_pickup" as Payment,
                        label: "Pay when collected",
                      },
                      { value: "pay_now" as Payment, label: "Pay now" },
                    ]}
                    value={draft.payment}
                    onChange={(payment) => set({ payment })}
                    small
                  />
                </div>
                {isGuest ? (
                  <div
                    className="cb-signin cb-item"
                    style={
                      { "--i": bookLines.length + 3 } as React.CSSProperties
                    }
                  >
                    <div
                      onClickCapture={() => {
                        try {
                          window.sessionStorage.setItem(
                            CARE_RESUME_KEY,
                            serviceKind,
                          );
                        } catch {
                          // The booking just will not reopen by itself.
                        }
                      }}
                    >
                      <GuestPortalPreview embedded redirectTo="/appointments" />
                    </div>
                  </div>
                ) : null}
              </>
            )}
            {error ? (
              <p className="cb-error" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <div className="cb-foot">
        {primary ? (
          <button
            type="button"
            className="cb-primary"
            disabled={primary.disabled}
            onClick={primary.onClick}
          >
            {draft.step === 0 ? <RouteIcon /> : null}
            {primary.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Segments<T extends string>({
  options,
  value,
  onChange,
  small = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  small?: boolean;
}) {
  return (
    <span
      className={["cb-segments", small ? "is-small" : ""].join(" ")}
      role="radiogroup"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}

function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
  icon = "place",
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  icon?: "place" | "time";
}) {
  return (
    <span className="cb-choice-cards" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {icon === "time" ? <TimeIcon /> : <PlaceIcon kind={option.value} />}
          <span>{option.label}</span>
        </button>
      ))}
    </span>
  );
}

function PlaceIcon({ kind }: { kind: string }) {
  if (kind === "store") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 10.5h16v9H4zM3 10.5l1.5-5h15l1.5 5M8 19.5v-5h4v5" />
      </svg>
    );
  }
  if (kind === "office") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 21V4h14v17M9 8h1M14 8h1M9 12h1M14 12h1M9 21v-4h6v4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m3 10 9-7 9 7v10H3zM9 20v-6h6v6" />
    </svg>
  );
}

function TimeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM22 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />
      <path d="M4.5 8v3.5c0 1.7 1.3 3 3 3h9c1.7 0 3 1.3 3 3V16" />
    </svg>
  );
}

function PhotoAddIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="13" height="12" rx="2" />
      <path d="m6 14 3-3 2.5 2.5 1.5-1.5 2 2M18.5 10v7M15 13.5h7" />
    </svg>
  );
}
