"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState, type ReactNode } from "react";

import type { CatalogueActionState } from "./actions";

export function CatalogueActionForm({
  action,
  children,
  className,
  submitLabel,
}: {
  action: (
    state: CatalogueActionState,
    formData: FormData,
  ) => Promise<CatalogueActionState>;
  children: ReactNode;
  className?: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
      {state.formError ? (
        <p
          role="alert"
          className="text-sm text-[var(--color-danger-500)] sm:col-span-full"
        >
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p
          role="status"
          className="text-sm text-[var(--color-success-500)] sm:col-span-full"
        >
          Saved.
        </p>
      ) : null}
    </form>
  );
}
