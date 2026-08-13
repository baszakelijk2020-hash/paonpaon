import { requireRetailerRole } from "@paon/auth";
import { RetailerBranchRepository } from "@paon/database";
import { redirect } from "next/navigation";

import { BranchLocationList } from "@/components/location-finder/branch-location-list";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function LocationsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }
  const branches = await new RetailerBranchRepository(
    await getSupabaseServerClient(),
  ).listByRetailer(session.retailerId);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
          FT-11 · Location Finder
        </p>
        <h1 className="font-display mt-2 text-4xl">House locations</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
          Review the authoritative locations configured for this retailer.
          Public contact, map and appointment presentation are deliberately
          shown only when the underlying location record supports them.
        </p>
      </header>
      <BranchLocationList branches={branches} />
    </div>
  );
}
