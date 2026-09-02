"use client";

import { buttonVariants } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { setDemoLoginsActive, type DemoLoginsActionState } from "./actions";

const initial: DemoLoginsActionState = {};

export function DemoLoginsForm() {
  const [activateState, activateAction, activatePending] = useActionState(
    setDemoLoginsActive,
    initial,
  );
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(
    setDemoLoginsActive,
    initial,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <form action={activateAction}>
          <input type="hidden" name="active" value="true" />
          <button
            type="submit"
            disabled={activatePending || deactivatePending}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
            })}
          >
            {activatePending ? "Activating…" : "Activate logins"}
          </button>
        </form>
        <form action={deactivateAction}>
          <input type="hidden" name="active" value="false" />
          <button
            type="submit"
            disabled={activatePending || deactivatePending}
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
            })}
          >
            {deactivatePending ? "Deactivating…" : "Deactivate"}
          </button>
        </form>
      </div>
      {activateState.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {activateState.formError}
        </p>
      ) : null}
      {activateState.saved ? (
        <p role="status" className="text-xs text-[var(--color-success-500)]">
          Demo logins activated.
        </p>
      ) : null}
      {deactivateState.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {deactivateState.formError}
        </p>
      ) : null}
      {deactivateState.saved ? (
        <p role="status" className="text-xs text-[var(--color-success-500)]">
          Demo logins deactivated.
        </p>
      ) : null}
    </div>
  );
}
