"use client";

import type { ConnectionOperationalState } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  transitionConnection,
  type ConnectionLifecycleActionState,
} from "./actions";

const initial: ConnectionLifecycleActionState = {};

const TRANSITIONS: Readonly<
  Record<ConnectionOperationalState, readonly ConnectionOperationalState[]>
> = {
  active: ["paused", "disconnected"],
  paused: ["active", "disconnected"],
  disconnected: [],
};

const LABELS: Record<ConnectionOperationalState, string> = {
  active: "Resume",
  paused: "Pause",
  disconnected: "Disconnect",
};

/**
 * Pause/resume/disconnect (PHASE 9.2). Only offers transitions
 * `planConnectionOperationalTransition` actually allows from the current
 * state — a disconnected connection has no buttons at all, since
 * reconnecting deliberately requires a new connection record rather than
 * reviving this one's cursors/secrets.
 */
export function ConnectionLifecycleControls({
  connectionId,
  operationalState,
}: {
  readonly connectionId: string;
  readonly operationalState: ConnectionOperationalState;
}) {
  const [state, action, pending] = useActionState(
    transitionConnection,
    initial,
  );
  const availableTargets = TRANSITIONS[operationalState] ?? [];

  if (availableTargets.length === 0) {
    return (
      <span className="text-xs text-[var(--color-stone-400)]">
        disconnected
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action} className="flex gap-2">
        <input type="hidden" name="connectionId" value={connectionId} />
        {availableTargets.map((target) => (
          <Button
            key={target}
            type="submit"
            name="requestedState"
            value={target}
            variant={target === "disconnected" ? "destructive" : "secondary"}
            size="sm"
            disabled={pending}
          >
            {LABELS[target]}
          </Button>
        ))}
      </form>
      {state.formError ? (
        <p className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </div>
  );
}
