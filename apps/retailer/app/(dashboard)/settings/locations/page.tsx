import { requireRetailerRole } from "@paon/auth";
import { RetailerBranchRepository } from "@paon/database";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function LocationsSettingsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }

  const repository = new RetailerBranchRepository(
    await getSupabaseServerClient(),
  );
  const branches = await repository.listByRetailer(session.retailerId);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
          Store management
        </p>
        <h1 className="font-display mt-2 text-4xl">Branch locations</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
          Edit the public location details for each of your branches. Only
          published branches appear in the customer location finder.
        </p>
      </div>

      {branches.length === 0 ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          No branches found.
        </p>
      ) : (
        <div className="space-y-3">
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={`/settings/locations/${branch.id}`}
              className="block rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white p-4 hover:bg-[var(--color-stone-50)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h2 className="font-medium text-[var(--color-stone-900)]">
                    {branch.name}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                    {branch.city && branch.country
                      ? `${branch.city}, ${branch.country}`
                      : branch.city || branch.country || "No location set"}
                  </p>
                  {branch.published ? (
                    <p className="mt-1 text-xs text-[var(--color-success-500)]">
                      Published to finder
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[var(--color-stone-400)]">
                      Not published
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--color-stone-400)]">
                    {branch.isDefault ? "Default" : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
