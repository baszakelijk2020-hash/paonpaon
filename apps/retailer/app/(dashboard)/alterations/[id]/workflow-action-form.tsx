"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState, type ReactNode } from "react";

import type { WorkflowActionState } from "./actions";

export function WorkflowActionForm({
  action,
  children,
  className,
  submitLabel,
  pendingLabel,
  buttonClassName,
}: {
  action: (
    state: WorkflowActionState,
    formData: FormData,
  ) => Promise<WorkflowActionState>;
  children: ReactNode;
  className?: string;
  submitLabel: string;
  pendingLabel: string;
  buttonClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className={className}>
      {children}
      <Button type="submit" disabled={pending} className={buttonClassName}>
        {pending ? pendingLabel : submitLabel}
      </Button>
      {state.formError ? (
        <p
          role="alert"
          className="text-sm text-[var(--color-danger-500)] sm:col-span-full"
        >
          {state.formError}
        </p>
      ) : null}
      {state.successMessage ? (
        <p
          role="status"
          className="text-sm text-[var(--color-success-500)] sm:col-span-full"
        >
          {state.successMessage}
        </p>
      ) : null}
    </form>
  );
}
