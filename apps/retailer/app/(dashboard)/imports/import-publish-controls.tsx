"use client";

import { Button } from "@paon/ui/components/Button";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import {
  dismissImportReviewTaskAction,
  publishCatalogueImportAction,
  publishCatalogueImportRowAction,
  type ImportActionState,
} from "./actions";

const initialState: ImportActionState = {};

function useRefreshOnSaved(state: ImportActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state.saved) {
      router.refresh();
    }
  }, [router, state.saved]);
}

export function ImportPublishControls(props: {
  readonly importId: string;
  readonly rowId?: string;
  readonly canPublish: boolean;
  readonly publishLabel: string;
}) {
  const action = props.rowId
    ? publishCatalogueImportRowAction
    : publishCatalogueImportAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  useRefreshOnSaved(state);

  return (
    <form action={formAction} className="inline">
      <input name="importId" type="hidden" value={props.importId} />
      {props.rowId ? (
        <input name="rowId" type="hidden" value={props.rowId} />
      ) : null}
      {state.formError ? (
        <p className="mb-2 text-sm text-[var(--color-danger-500)]" role="alert">
          {state.formError}
        </p>
      ) : null}
      <Button disabled={!props.canPublish || pending} type="submit">
        {pending ? "Publishing…" : props.publishLabel}
      </Button>
    </form>
  );
}

export function ImportReviewTaskControls(props: {
  readonly importId: string;
  readonly taskId: string;
  readonly canDismiss: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    dismissImportReviewTaskAction,
    initialState,
  );
  useRefreshOnSaved(state);

  if (!props.canDismiss) {
    return null;
  }

  return (
    <form action={formAction} className="inline">
      <input name="importId" type="hidden" value={props.importId} />
      <input name="taskId" type="hidden" value={props.taskId} />
      {state.formError ? (
        <p className="text-sm text-[var(--color-danger-500)]" role="alert">
          {state.formError}
        </p>
      ) : null}
      <Button disabled={pending} type="submit" variant="outline">
        {pending ? "Saving…" : "Dismiss"}
      </Button>
    </form>
  );
}
