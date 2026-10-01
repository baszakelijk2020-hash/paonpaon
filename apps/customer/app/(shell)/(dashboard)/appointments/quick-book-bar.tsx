"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { bookAppointment } from "./booking-actions";
import type { BookableBranch } from "./booking-flow";
import { LocationFinder } from "./location-finder";

interface QuickBookBarProps {
  readonly retailerId: string;
  readonly branches: readonly BookableBranch[];
}

/** Which pill is currently expanded into its drawer. Only ever one. */
type OpenField = "date" | "time" | "party" | "branch" | null;

/**
 * A booking that is a request rather than a reservation. `after_hours` asks the
 * retailer to open outside published hours; `priority` asks them to make room in
 * a slot that is already taken. Neither holds the time until the retailer says
 * yes, which is why they are worded as requests and not as Continue.
 */
type RequestKind = "standard" | "after_hours" | "priority";

const RUSH_ICON = "https://www.nebelspiegel.com/images/rush.png";
const VIP_ICON = "https://www.nebelspiegel.com/images/vipaccess.png";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/** Whole and half hours, 10:00 to 18:00. */
export const HALF_HOUR_SLOTS: readonly string[] = Array.from(
  { length: 17 },
  (_, i) =>
    `${String(10 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);

export function QuickBookBar({ retailerId, branches }: QuickBookBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [partySize, setPartySize] = useState("1");
  const [openField, setOpenField] = useState<OpenField>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [requestKind, setRequestKind] = useState<RequestKind>("standard");
  const [comment, setComment] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(
    branches.length > 0 ? branches[0]!.id : "",
  );

  const [state, formAction, isPending] = useActionState(bookAppointment, {
    fieldErrors: {},
  });

  // Lets the page react to a booking made here — an invited guest who books
  // a fitting of their own is shown to their organizer as rebooked.
  useEffect(() => {
    if (state.success && state.appointmentId) {
      window.dispatchEvent(
        new CustomEvent("paon:appointment-booked", {
          detail: { appointmentId: state.appointmentId },
        }),
      );
    }
  }, [state.success, state.appointmentId]);

  // A drawer is a popover in everything but name: clicking the page or pressing
  // Escape closes it, otherwise an open drawer covers what the reader clicks next.
  useEffect(() => {
    if (!openField) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenField(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenField(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openField]);

  const isIncomplete =
    !date || !time || (branches.length > 0 && !selectedBranch);

  const openConfirm = (kind: RequestKind) => {
    if (isIncomplete) return;
    setRequestKind(kind);
    setOpenField(null);
    setShowConfirm(true);
  };

  const setRelativeDate = (offset: number) => {
    const next = new Date();
    next.setHours(12, 0, 0, 0);
    next.setDate(next.getDate() + offset);
    setDate(toISODate(next));
    setOpenField(null);
  };

  const handleConfirm = () => {
    if (isIncomplete) return;

    const startsAt = zonedISO(
      date,
      time,
      branches.find((b) => b.id === selectedBranch)?.timezone,
    );

    const formData = new FormData();
    formData.set("retailerId", retailerId);
    formData.set("reason", "in_the_mood_for_something_fresh");
    if (selectedBranch) formData.set("branchId", selectedBranch);
    formData.set("startsAt", startsAt);
    if (partySize !== "1" || comment || requestKind !== "standard") {
      const notes = [
        `Party of ${partySize}`,
        requestKind === "after_hours"
          ? `AFTER-HOURS REQUEST: preferred ${date} at ${time}; no slot is held until the retailer confirms.`
          : "",
        requestKind === "priority"
          ? `PRIORITY BOOKING REQUEST: ${date} at ${time} is shown as taken; asking the retailer to make room.`
          : "",
        comment ? `Notes: ${comment}` : "",
      ]
        .filter(Boolean)
        .join(" — ");
      formData.set("notes", notes);
    }

    formAction(formData);

    if (state.success) {
      setShowConfirm(false);
      setDate("");
      setTime("10:00");
      setPartySize("1");
      setComment("");
      setRequestKind("standard");
    }
  };

  // For today, only the hours still ahead: a slot must start after now.
  const isToday = date === toISODate(new Date());
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const timeSlots = HALF_HOUR_SLOTS.filter(
    (slot) => !isToday || slotMinutes(slot) > nowMinutes,
  );

  // Picking today late in the day moves a time that has already passed on to
  // the first one still open.
  const firstOpenSlot = timeSlots[0];
  const noTimesLeft = isToday && !firstOpenSlot;
  useEffect(() => {
    if (!isToday || !firstOpenSlot) return;
    if (slotMinutes(time) > nowMinutes) return;
    setTime(firstOpenSlot);
  }, [isToday, time, nowMinutes, firstOpenSlot]);

  const toggle = (field: Exclude<OpenField, null>) =>
    setOpenField((current) => (current === field ? null : field));

  if (showConfirm) {
    return (
      <div ref={containerRef} className="appointment-quick-book-container">
        <div className="appointment-quick-book-confirm">
          <div className="appointment-quick-book-confirm-header">
            <h3>
              {requestKind === "after_hours"
                ? "Request an after-hours appointment"
                : requestKind === "priority"
                  ? "Request priority booking"
                  : "Confirm appointment"}
            </h3>
            <button
              onClick={() => setShowConfirm(false)}
              className="appointment-quick-book-close"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {requestKind !== "standard" ? (
            <p className="appointment-quick-book-fit-me-in-note">
              {requestKind === "after_hours"
                ? "We will ask the atelier to open outside its published hours. Your preferred time is not held until they confirm it."
                : "We will ask the atelier to make room in a slot that is already taken. Your preferred time is not held until they confirm it."}
            </p>
          ) : null}

          <div className="appointment-quick-book-confirm-summary">
            <p className="appointment-quick-book-summary-line">
              {new Date(date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}{" "}
              at {time} · Party of {partySize}
              {branches.length > 0 && selectedBranch
                ? ` · ${branches.find((b) => b.id === selectedBranch)?.name || ""}`
                : ""}
            </p>
          </div>

          <div className="appointment-quick-book-confirm-field">
            <label
              htmlFor="qb-comment"
              className="appointment-quick-book-label"
            >
              Anything we should know?
            </label>
            <textarea
              id="qb-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              placeholder="Optional notes..."
              className="appointment-quick-book-textarea"
              maxLength={500}
            />
          </div>

          {state.formError && (
            <p className="appointment-quick-book-error">{state.formError}</p>
          )}

          <div className="appointment-quick-book-confirm-actions">
            <button
              onClick={() => setShowConfirm(false)}
              className="appointment-quick-book-confirm-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="appointment-quick-book-confirm-primary"
            >
              {isPending
                ? "Confirming..."
                : requestKind === "standard"
                  ? "Confirm appointment"
                  : "Send request"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="appointment-quick-book-container">
      <div
        className="appointment-quick-book-bar"
        data-open={openField ?? undefined}
      >
        <button
          type="button"
          onClick={() => setRelativeDate(0)}
          className="appointment-quick-book-shortcut"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setRelativeDate(1)}
          className="appointment-quick-book-shortcut"
        >
          Tomorrow
        </button>

        <QuickBookField
          label={date ? formatDateLabel(date) : "dd / mm / yyyy"}
          placeholder={!date}
          open={openField === "date"}
          onToggle={() => toggle("date")}
          drawerLabel="Choose a date"
          grow={1}
        >
          <MiniCalendar
            value={date}
            onSelect={(next) => {
              setDate(next);
              setOpenField(null);
            }}
          />
        </QuickBookField>

        <QuickBookField
          label={noTimesLeft ? "No times left today" : time}
          placeholder={noTimesLeft}
          open={openField === "time"}
          onToggle={() => toggle("time")}
          drawerLabel="Choose a time"
          grow={0.6}
        >
          <div className="appointment-quick-book-options">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                className="appointment-quick-book-option"
                aria-pressed={slot === time}
                onClick={() => {
                  setTime(slot);
                  setOpenField(null);
                }}
              >
                {slot}
              </button>
            ))}
          </div>
          <div className="appointment-quick-book-requests">
            <button
              type="button"
              className="appointment-quick-book-request"
              disabled={isIncomplete || isPending}
              onClick={() => openConfirm("after_hours")}
            >
              <span>Request after-hours appointment</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={RUSH_ICON} alt="" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="appointment-quick-book-request"
              disabled={isIncomplete || isPending}
              onClick={() => openConfirm("priority")}
            >
              <span>Request priority booking</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={VIP_ICON} alt="" aria-hidden="true" />
            </button>
          </div>
        </QuickBookField>

        <QuickBookField
          label={partySize === "1" ? "1 person" : `${partySize} people`}
          grow={0.7}
          open={openField === "party"}
          onToggle={() => toggle("party")}
          drawerLabel="How many people"
        >
          <div className="appointment-quick-book-options">
            {Array.from({ length: 8 }, (_, i) => String(i + 1)).map((size) => (
              <button
                key={size}
                type="button"
                className="appointment-quick-book-option"
                aria-pressed={size === partySize}
                onClick={() => {
                  setPartySize(size);
                  setOpenField(null);
                }}
              >
                {size === "1" ? "1 person" : `${size} people`}
              </button>
            ))}
          </div>
        </QuickBookField>

        {branches.length > 0 && (
          <QuickBookField
            label={
              branches.find((b) => b.id === selectedBranch)?.name ?? "Location"
            }
            grow={1.7}
            {...(branches.find((b) => b.id === selectedBranch)?.address
              ? {
                  sublabel: branches.find((b) => b.id === selectedBranch)!
                    .address!,
                }
              : {})}
            open={openField === "branch"}
            onToggle={() => toggle("branch")}
            drawerLabel="Which atelier"
          >
            <LocationFinder
              branches={branches}
              selectedBranchId={selectedBranch}
              onSelect={(branch) => {
                setSelectedBranch(branch.id);
                setOpenField(null);
              }}
            />
          </QuickBookField>
        )}

        <button
          onClick={() => openConfirm("standard")}
          disabled={isIncomplete || isPending || noTimesLeft}
          className="appointment-quick-book-button"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/**
 * A pill that becomes its own drawer. The drawer is absolutely positioned from
 * the pill's own top edge so the pill appears to grow downwards rather than a
 * separate panel appearing beneath it, and the row's height never changes.
 */
export function QuickBookField({
  label,
  sublabel,
  placeholder = false,
  open,
  onToggle,
  drawerLabel,
  grow = 1,
  children,
}: {
  label: string;
  /** A small second line, e.g. a location's street and number. */
  sublabel?: string;
  placeholder?: boolean;
  open: boolean;
  onToggle: () => void;
  drawerLabel: string;
  grow?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="appointment-quick-book-field"
      data-open={open || undefined}
      style={{ flexGrow: grow }}
    >
      {/* The trigger keeps its space so the row never changes height, but it must
          not paint: the drawer opens from the pill's own top edge, and a visible
          trigger showed through as a curved lip across the first row of options. */}
      <button
        type="button"
        className="appointment-quick-book-trigger"
        data-placeholder={placeholder || undefined}
        aria-expanded={open}
        onClick={onToggle}
        style={open ? { visibility: "hidden" } : undefined}
      >
        {sublabel ? (
          <span className="appointment-quick-book-trigger-inline">
            <span>{label}</span>
            <small>{` – ${sublabel}`}</small>
          </span>
        ) : (
          label
        )}
      </button>
      {open ? (
        <div className="appointment-quick-book-drawer" role="group">
          <span className="appointment-quick-book-drawer-label">
            {drawerLabel}
          </span>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Month grid, Monday first, past days disabled. */
export function MiniCalendar({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (iso: string) => void;
}) {
  const today = startOfDay(new Date());
  const selected = value ? parseISODate(value) : null;
  const [cursor, setCursor] = useState(() =>
    selected
      ? new Date(selected.getFullYear(), selected.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay() is Sunday-first; the grid is Monday-first.
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;

  return (
    <div className="appointment-quick-book-calendar">
      <div className="appointment-quick-book-calendar-head">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          ←
        </button>
        <strong>
          {cursor.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          })}
        </strong>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          →
        </button>
      </div>
      <div className="appointment-quick-book-calendar-grid">
        {WEEKDAY_LABELS.map((day, index) => (
          <span key={index} className="appointment-quick-book-calendar-weekday">
            {day}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = new Date(year, month, i + 1);
          const iso = toISODate(day);
          const isPast = day < today;
          return (
            <button
              key={iso}
              type="button"
              disabled={isPast}
              aria-pressed={iso === value}
              data-today={day.getTime() === today.getTime() || undefined}
              className="appointment-quick-book-calendar-day"
              onClick={() => onSelect(iso)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Local calendar date, never `toISOString()` — that shifts the day in any zone west of UTC. */
export function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * A wall-clock date and time at a location, as an ISO instant. 14:30 at the
 * Antwerp atelier is 14:30 in Antwerp, whatever zone the browser is in; a
 * location without a zone falls back to the browser's own.
 */
export function zonedISO(date: string, time: string, timeZone?: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (!timeZone) {
    return new Date(
      year ?? 2026,
      (month ?? 1) - 1,
      day ?? 1,
      hour ?? 10,
      minute ?? 0,
    ).toISOString();
  }
  const wall = Date.UTC(
    year ?? 2026,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 10,
    minute ?? 0,
  );
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(instant));
    const get = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    return (
      Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second"),
      ) - instant
    );
  };
  // Two passes settle the offset across a daylight-saving change.
  let instant = wall - offsetAt(wall);
  instant = wall - offsetAt(instant);
  return new Date(instant).toISOString();
}

/** An ISO instant as the date and time on the wall at a location. */
export function zonedWallTime(iso: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    ...(timeZone ? { timeZone } : {}),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function slotMinutes(slot: string) {
  const [hour, minute] = slot.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function parseISODate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1);
}

export function formatDateLabel(iso: string) {
  const date = parseISODate(iso);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
