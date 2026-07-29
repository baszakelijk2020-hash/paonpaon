"use client";

import { useEffect, useState } from "react";

const GLOSSARY_SEEN_KEY = "paon-glossary-seen";

const TERMS: Array<[string, string]> = [
  ["Brief", "your home screen — today's attention items"],
  ["Appointments", "the calendar — fittings and consultations"],
  ["Clients", "your customer relationships and history"],
  ["Messages", "conversations with clients"],
  ["Products", "your catalogue and stock"],
];

/** High 29 mitigation: a first-run explainer for the naming a new
 * team member has never seen before — dismissed once, remembered
 * locally, never shown again on this device. */
export function GlossaryBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(GLOSSARY_SEEN_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(GLOSSARY_SEEN_KEY, "1");
    } catch {
      // localStorage unavailable — dismiss for this render only.
    }
    setDismissed(true);
  }

  return (
    <div className="paon-reveal flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-[var(--color-stone-50)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-stone-600)]">
        <span className="font-medium text-[var(--color-stone-900)]">
          New here?
        </span>
        {TERMS.map(([term, meaning]) => (
          <span key={term}>
            <span className="font-medium text-[var(--color-stone-800)]">
              {term}
            </span>{" "}
            = {meaning}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 self-start text-xs uppercase tracking-wide text-[var(--color-stone-500)] underline sm:self-auto"
      >
        Got it
      </button>
    </div>
  );
}
