import { requireRetailerRole } from "@paon/auth";
import { CatalogueImportRepository } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ImportUploadForm } from "./import-upload-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ImportsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/dashboard");
  }

  const imports = await new CatalogueImportRepository(
    await getSupabaseServerClient(),
  ).listForRetailer(session.retailerId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
          Catalogue intelligence
        </p>
        <h1 className="font-display mt-2 text-4xl text-[var(--color-stone-900)]">
          Catalogue import
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
          Download the PAON contract, upload a supplier file, review the
          explained preview, then publish valid reviewed rows transactionally.
        </p>
      </div>

      <section aria-labelledby="templates-heading" className="grid gap-3">
        <h2
          id="templates-heading"
          className="font-display text-3xl text-[var(--color-stone-900)]"
        >
          Downloadable contracts
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/imports/templates/csv"
          >
            CSV template
          </Link>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/imports/templates/xlsx"
          >
            XLSX template
          </Link>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/imports/templates/json"
          >
            JSON template
          </Link>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/imports/templates/llm"
          >
            LLM contract
          </Link>
        </div>
      </section>

      <ImportUploadForm />

      <section aria-labelledby="recent-imports-heading" className="grid gap-4">
        <div>
          <h2
            id="recent-imports-heading"
            className="font-display text-3xl text-[var(--color-stone-900)]"
          >
            Recent imports
          </h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            {imports.length} import{imports.length === 1 ? "" : "s"} retained
          </p>
        </div>
        {imports.length === 0 ? (
          <Card className="border-dashed py-14 text-center">
            <p className="font-display text-2xl">No imports yet.</p>
            <p className="mt-2 text-sm text-[var(--color-stone-500)]">
              Upload a supplier file to create the first explained preview.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {imports.map((job) => (
              <Card
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {job.sourceFilename}
                  </p>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {job.rowCount} row{job.rowCount === 1 ? "" : "s"} ·{" "}
                    {job.sourceType.toUpperCase()} · contract{" "}
                    {job.contractVersion}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    tone={
                      job.status === "completed"
                        ? "success"
                        : job.status === "failed"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {job.status}
                  </Badge>
                  <Link
                    className={buttonVariants({ variant: "outline" })}
                    href={`/imports/${job.id}`}
                  >
                    Open import
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
