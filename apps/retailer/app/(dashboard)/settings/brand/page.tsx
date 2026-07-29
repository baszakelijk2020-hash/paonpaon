import { requireRetailerRole } from "@paon/auth";
import { RetailerRepository } from "@paon/database";
import { notFound, redirect } from "next/navigation";

import { restoreBrandTheme } from "./actions";
import { BrandThemeForm } from "./brand-theme-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function BrandSettingsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }
  const repository = new RetailerRepository(await getSupabaseServerClient());
  const [retailer, versions] = await Promise.all([
    repository.findById(session.retailerId),
    repository.listBrandThemeVersions(session.retailerId),
  ]);
  if (!retailer) notFound();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
          Retail identity
        </p>
        <h1 className="font-display mt-2 text-4xl">Brand configuration</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
          Curated tokens personalize storefront and operating surfaces without
          custom CSS, scripts or duplicated PAON components.
        </p>
      </div>
      <BrandThemeForm
        initialTheme={retailer.brandTheme}
        retailerName={retailer.displayName}
      />
      <section className="rounded-[var(--radius-md)] border bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl">Version history</h2>
        {versions.length ? (
          <div className="mt-5 divide-y">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    Version {version.versionNumber} · {version.changeNote}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                    {new Date(version.createdAt).toLocaleString()}
                  </p>
                </div>
                <form action={restoreBrandTheme}>
                  <input
                    type="hidden"
                    name="versionNumber"
                    value={version.versionNumber}
                  />
                  <button
                    className="min-h-11 rounded-[var(--radius-md)] border px-4 text-sm"
                    type="submit"
                  >
                    Restore this version
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-stone-500)]">
            Publish the first configuration to begin a restorable history.
          </p>
        )}
      </section>
    </div>
  );
}
