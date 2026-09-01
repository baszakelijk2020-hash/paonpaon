"use client";

import { useActionState } from "react";

import { signOut, type SignOutState } from "../actions";

const initialState: SignOutState = null;

/** Renders the existing `signOut` server action as a real control. Used both
 * in the top-nav trailing slot (desktop) and inline on the account page
 * (mobile, where the trailing slot is hidden) so it is reachable regardless
 * of viewport. `useActionState` (not a plain `<form action={signOut}>`) so a
 * failed signOut can surface an inline error instead of silently redirecting
 * as if the session had cleared. */
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
      <button
        type="submit"
        disabled={isPending}
        className="flex h-full w-full items-center justify-center text-[12px] font-medium tracking-[0.01em] text-[var(--color-stone-600)] transition-colors duration-200 hover:bg-white/60 hover:text-[var(--customer-ink)] disabled:opacity-60 sm:px-3 sm:text-[13px]"
      >
        {isPending ? "Signing out…" : "Sign out"}
      </button>
      {state?.error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
