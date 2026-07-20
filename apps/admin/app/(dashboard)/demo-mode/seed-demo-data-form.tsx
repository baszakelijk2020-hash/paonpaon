"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { runDemoSeed, type DemoModeState } from "./actions";

const initial: DemoModeState = {};

export function SeedDemoDataForm() {
  const [state, action, pending] = useActionState(runDemoSeed, initial);

  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Populating…" : "Populate demo data"}
      </Button>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.result ? (
        <p className="text-sm text-[var(--color-success-500)]">
          Done — {state.result.count} demo accounts ready.
        </p>
      ) : null}
    </form>
  );
}
