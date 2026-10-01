"use client";

import { useState, useTransition } from "react";

/** Runs a server action from an event handler and keeps any thrown error as
 * a visible message instead of letting it reach an error boundary. */
export function useActionRunner(): {
  pending: boolean;
  error: string | null;
  run: (action: () => Promise<unknown>) => void;
  clearError: () => void;
} {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message
            ? caught.message
            : "Something went wrong. Please try again.",
        );
      }
    });
  }

  return { pending, error, run, clearError: () => setError(null) };
}

/** Id of the "You" rail's single next-action button. */
export const NEXT_ACTION_ID = "fitting-room-next";

/** Moves focus to the "You" rail's next-action button on the same page (no
 * route change), so the stage can point at it. */
export function focusNextAction(event?: { preventDefault: () => void }): void {
  event?.preventDefault();
  const button = document.getElementById(NEXT_ACTION_ID);
  button?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  button?.focus({ preventScroll: true });
}
