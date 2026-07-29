"use client";

import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";

export function ImportUploadForm({
  action,
  pending,
  formError,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  formError?: string;
}) {
  return (
    <Card>
      <form action={action} className="grid gap-4">
        <div>
          <h2 className="font-display text-2xl text-[var(--color-stone-900)]">
            Upload supplier file
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            CSV, XLSX, and JSON contracts are supported. PDF extraction stays
            reserved for a later provider.
          </p>
        </div>

        <label className="grid gap-2 text-sm">
          <span className="font-medium text-[var(--color-stone-700)]">
            Supplier file
          </span>
          <input
            type="file"
            name="file"
            accept=".csv,.xlsx,.xls,.json,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="block w-full text-sm text-[var(--color-stone-600)] file:mr-4 file:rounded-[var(--radius-md)] file:border-0 file:bg-[var(--color-stone-100)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--color-stone-900)]"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Parsing…" : "Preview import"}
          </Button>
          <Link
            href="/imports/template?format=csv"
            className="inline-flex items-center text-sm font-medium text-[var(--color-stone-700)] underline"
          >
            Download CSV template
          </Link>
          <Link
            href="/imports/template?format=json"
            className="inline-flex items-center text-sm font-medium text-[var(--color-stone-700)] underline"
          >
            Download JSON contract
          </Link>
        </div>

        {formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-600)]">
            {formError}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
