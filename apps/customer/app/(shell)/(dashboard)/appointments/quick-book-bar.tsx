"use client";

import { useActionState, useState } from "react";

import { bookAppointment } from "./booking-actions";
import type { BookableBranch } from "./booking-flow";

interface QuickBookBarProps {
  readonly retailerId: string;
  readonly branches: readonly BookableBranch[];
}

export function QuickBookBar({ retailerId, branches }: QuickBookBarProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [partySize, setPartySize] = useState("1");
  const [showConfirm, setShowConfirm] = useState(false);
  const [comment, setComment] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(
    branches.length > 0 ? branches[0]!.id : "",
  );

  const [state, formAction, isPending] = useActionState(bookAppointment, {
    fieldErrors: {},
  });

  const handleBook = () => {
    if (!date || !time || !selectedBranch) return;
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!date || !time || !selectedBranch) return;

    const dateParts = date.split("-");
    const timeParts = time.split(":");
    const year = parseInt(dateParts[0] || "2024");
    const month = parseInt(dateParts[1] || "1");
    const day = parseInt(dateParts[2] || "1");
    const hour = parseInt(timeParts[0] || "10");
    const minute = parseInt(timeParts[1] || "0");

    const startsAt = new Date(year, month - 1, day, hour, minute).toISOString();

    const formData = new FormData();
    formData.set("retailerId", retailerId);
    formData.set("reason", "in_the_mood_for_something_fresh");
    formData.set("branchId", selectedBranch);
    formData.set("startsAt", startsAt);
    if (partySize !== "1" || comment) {
      const notes = [
        `Party of ${partySize}`,
        comment ? `Notes: ${comment}` : "",
      ]
        .filter(Boolean)
        .join(" — ");
      formData.set("notes", notes);
    }

    await formAction(formData);

    if (state.success) {
      setShowConfirm(false);
      setDate("");
      setTime("10:00");
      setPartySize("1");
      setComment("");
    }
  };

  const minDate = new Date().toISOString().split("T")[0];
  const timeSlots = Array.from({ length: 9 }, (_, i) => {
    const hour = 10 + i;
    return `${String(hour).padStart(2, "0")}:00`;
  });

  return (
    <div className="appointment-quick-book-container">
      {!showConfirm ? (
        <div className="appointment-quick-book-bar">
          <div className="appointment-quick-book-field">
            <label htmlFor="qb-date" className="appointment-quick-book-label">
              Date
            </label>
            <input
              id="qb-date"
              type="date"
              min={minDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="appointment-quick-book-input"
            />
          </div>

          <div className="appointment-quick-book-field">
            <label htmlFor="qb-time" className="appointment-quick-book-label">
              Time
            </label>
            <select
              id="qb-time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="appointment-quick-book-input"
            >
              {timeSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>

          <div className="appointment-quick-book-field">
            <label htmlFor="qb-party" className="appointment-quick-book-label">
              Party size
            </label>
            <select
              id="qb-party"
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              className="appointment-quick-book-input"
            >
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {i === 0 ? "1 person" : `${i + 1} people`}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleBook}
            disabled={!date || !time || !selectedBranch || isPending}
            className="appointment-quick-book-button"
          >
            Book
          </button>
        </div>
      ) : (
        <div className="appointment-quick-book-confirm">
          <div className="appointment-quick-book-confirm-header">
            <h3>Confirm appointment</h3>
            <button
              onClick={() => setShowConfirm(false)}
              className="appointment-quick-book-close"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="appointment-quick-book-confirm-summary">
            <p className="appointment-quick-book-summary-line">
              {new Date(date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}{" "}
              at {time} · Party of {partySize}
            </p>
          </div>

          {branches.length > 1 && (
            <div className="appointment-quick-book-confirm-field">
              <label
                htmlFor="qb-confirm-branch"
                className="appointment-quick-book-label"
              >
                Location
              </label>
              <select
                id="qb-confirm-branch"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="appointment-quick-book-input"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {isPending ? "Confirming..." : "Confirm appointment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
