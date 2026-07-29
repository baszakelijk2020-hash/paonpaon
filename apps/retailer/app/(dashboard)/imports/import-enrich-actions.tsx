"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { enrichImportRow, type ImportEnrichState } from "./actions";

const initialState: ImportEnrichState = {};

export function EnrichRowButton({
  importId,
  importRowId,
  disabled,
}: {
  importId: string;
  importRowId: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(
    enrichImportRow,
    initialState,
  );

  return (
    <form action={action} className="grid gap-2">
      <input name="importId" type="hidden" value={importId} />
      <input name="importRowId" type="hidden" value={importRowId} />
      <Button disabled={disabled || pending} type="submit" variant="outline">
        {pending ? "Enriching…" : "AI enrich row"}
      </Button>
      {state.message ? (
        <p className="text-sm text-[var(--color-stone-600)]" role="status">
          {state.message}
        </p>
      ) : null}
      {state.formError ? (
        <p className="text-sm text-[var(--color-danger-500)]" role="alert">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
