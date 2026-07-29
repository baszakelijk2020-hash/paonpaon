import { requireRetailerRole } from "@paon/auth";
import { CatalogueImportRepository } from "@paon/database";
import { redirect } from "next/navigation";

import { ImportsLanding } from "./import-preview-table";

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
  ).findByRetailer(session.retailerId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
          Catalogue intelligence
        </p>
        <h1 className="font-display mt-2 text-4xl text-[var(--color-stone-900)]">
          Import preview
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
          Upload supplier CSV, XLSX, or JSON files to validate mappings,
          preserve raw values, and explain duplicates before anything publishes.
        </p>
      </div>

      <ImportsLanding
        imports={imports.map((item) => ({
          id: item.id,
          sourceFilename: item.sourceFilename,
          sourceType: item.sourceType,
          rowCount: item.rowCount,
          createdAt: item.createdAt,
          status: item.status,
        }))}
      />
    </div>
  );
}
