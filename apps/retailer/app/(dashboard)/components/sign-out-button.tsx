"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { signOut, type SignOutState } from "../actions";

const initialState: SignOutState = null;

/** Renders the retailer `signOut` server action as a real submit control.
 * Mounted as two independent instances by the dashboard layout — once in the
 * desktop sidebar, once in the mobile drawer — so AppShell never has to reuse
 * a single server-rendered `<form action={serverAction}>` element across both
 * DOM locations (docs/PHASE.md "REAL BUG FOUND, NOT FIXED 2026-08-19": that
 * shared instance produced a click that registered in the DOM but sent zero
 * POST requests). `useActionState` (not a bare `<form action={signOut}>`) so a
 * failed signOut can surface an inline error instead of silently redirecting
 * as if the session had cleared. Global scope — see ../actions.ts. */
export function SignOutButton({
  className,
  testId,
}: {
  className?: string;
  testId?: string;
}) {
  const [state, formAction, isPending] = useActionState(signOut, initialState);

  return (
    <form action={formAction} className={className} data-testid={testId}>
      <Button type="submit" variant="ghost" size="sm" disabled={isPending}>
        {isPending ? "Signing out…" : "Sign out"}
      </Button>
      {state?.error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
