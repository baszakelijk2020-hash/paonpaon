"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { updateTaskStatus } from "../[id]/actions";

/** One tap moves a task along the bench: start it, or hand it to review. */
export function TaskMove({
  taskId,
  alterationId,
  next,
}: {
  taskId: string;
  alterationId: string;
  next: "in_progress" | "review_ready";
}) {
  const [state, formAction, pending] = useActionState(
    updateTaskStatus.bind(null, taskId, alterationId),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="taskStatus" value={next} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending
          ? "Saving…"
          : next === "in_progress"
            ? "Start"
            : "Ready for review"}
      </Button>
      {state.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
