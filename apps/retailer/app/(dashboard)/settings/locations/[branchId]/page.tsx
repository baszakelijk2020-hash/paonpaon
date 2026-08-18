import { requireRetailerRole } from "@paon/auth";
import { RetailerBranchRepository } from "@paon/database";
import { notFound, redirect } from "next/navigation";

import { updateBranchLocation } from "./actions";
import { LocationDetailsForm } from "./location-details-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }

  const repository = new RetailerBranchRepository(
    await getSupabaseServerClient(),
  );
  const branch = await repository.findById(
    session.retailerId,
    branchId as never,
  );

  if (!branch) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
          Store management
        </p>
        <h1 className="font-display mt-2 text-4xl">{branch.name}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
          Edit the public location details that appear in the customer location
          finder.
        </p>
      </div>

      <LocationDetailsForm
        branchId={branchId}
        branch={branch}
        action={updateBranchLocation}
      />
    </div>
  );
}
