"use client";

import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import { previewCatalogueImport, type ImportUploadState } from "./actions";

const initialState: ImportUploadState = {};

export function ImportUploadForm() {
  const [state, action, pending] = useActionState(
    previewCatalogueImport,
    initialState,
  );

  return (
    <Card className="grid gap-4 p-6">
      <div>
        <h2 className="font-display text-2xl text-[var(--color-stone-900)]">
          Upload for preview
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          CSV, XLSX, or JSON only. Preview explains mappings, duplicates, and
          asset matches before transactional publishing.
        </p>
      </div>
      <form action={action} className="grid gap-4">
        <label className="grid gap-2 text-sm text-[var(--color-stone-700)]">
          Supplier file
          <input
            type="file"
            name="file"
            accept=".csv,.xlsx,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-stone-900)] file:px-3 file:py-2 file:text-sm file:text-white"
          />
        </label>
        {state.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Building preview…" : "Preview import"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
