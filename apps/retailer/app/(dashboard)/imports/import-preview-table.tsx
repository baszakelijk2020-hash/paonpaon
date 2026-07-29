"use client";

import type { CatalogueImportRow } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { useActionState } from "react";

import { uploadCatalogueImport, type ImportUploadState } from "./actions";
import { ImportUploadForm } from "./import-upload-form";

export function ImportPreviewTable({ rows }: { rows: CatalogueImportRow[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="min-w-full text-left text-sm">
        <caption className="sr-only">Import preview rows</caption>
        <thead className="border-b border-[var(--color-stone-100)] bg-[var(--color-stone-50)]">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Row
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              SKU
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Mapping
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Issues
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-stone-100)]">
          {rows.map((row) => (
            <tr key={row.rowNumber}>
              <td className="px-4 py-3 align-top">{row.rowNumber}</td>
              <td className="px-4 py-3 align-top font-medium">
                {row.externalSku || "—"}
              </td>
              <td className="px-4 py-3 align-top">
                <Badge tone={row.status === "valid" ? "success" : "danger"}>
                  {row.status}
                </Badge>
              </td>
              <td className="px-4 py-3 align-top text-[var(--color-stone-600)]">
                {row.proposedProduct ? (
                  <div className="space-y-1">
                    <p>{row.proposedProduct.name}</p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {row.proposedProduct.assets.note}
                    </p>
                    {row.proposedProduct.assignments.slice(0, 3).map((item) => (
                      <p
                        key={`${item.kind}-${item.supplierValue}`}
                        className="text-xs"
                      >
                        {item.kind}: {item.supplierValue} ({item.status})
                      </p>
                    ))}
                  </div>
                ) : (
                  <span className="text-[var(--color-stone-500)]">
                    Unmapped
                  </span>
                )}
              </td>
              <td className="px-4 py-3 align-top">
                {row.validationErrors.length === 0 ? (
                  <span className="text-[var(--color-stone-500)]">None</span>
                ) : (
                  <ul className="list-disc pl-4 text-[var(--color-stone-600)]">
                    {row.validationErrors.map((error) => (
                      <li key={`${error.field}-${error.message}`}>
                        {error.field}: {error.message}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const initialState: ImportUploadState = {};

export function ImportsLanding({
  imports,
}: {
  imports: Array<{
    id: string;
    sourceFilename: string;
    sourceType: string;
    rowCount: number;
    createdAt: string;
    status: string;
  }>;
}) {
  const [state, action, pending] = useActionState(
    uploadCatalogueImport,
    initialState,
  );

  return (
    <div className="grid gap-6">
      <ImportUploadForm
        action={action}
        pending={pending}
        {...(state.formError ? { formError: state.formError } : {})}
      />

      <section aria-labelledby="recent-imports-heading" className="grid gap-3">
        <div>
          <h2
            id="recent-imports-heading"
            className="font-display text-3xl text-[var(--color-stone-900)]"
          >
            Recent previews
          </h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            Preview jobs retain raw supplier values. Nothing publishes from this
            stage.
          </p>
        </div>
        {imports.length === 0 ? (
          <Card className="border-dashed py-10 text-center">
            <p className="text-sm text-[var(--color-stone-500)]">
              No import previews yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {imports.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--color-stone-900)]">
                      {item.sourceFilename}
                    </p>
                    <p className="text-sm text-[var(--color-stone-500)]">
                      {item.sourceType.toUpperCase()} · {item.rowCount} row
                      {item.rowCount === 1 ? "" : "s"} ·{" "}
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Link
                    href={`/imports/${item.id}`}
                    className="text-sm font-medium text-[var(--color-stone-900)] underline"
                  >
                    Open preview
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
