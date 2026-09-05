import { CustomerRepository, RetailerRepository } from "@paon/database";
import Link from "next/link";

import { NewWeddingPartyForm } from "./new-wedding-party-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function NewWeddingPartyPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const relationships = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const retailers = (
    await Promise.all(
      relationships.map((customer) =>
        retailerRepo.findById(customer.retailerId),
      ),
    )
  ).filter((retailer): retailer is NonNullable<typeof retailer> => !!retailer);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Start a wedding party
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Set the date and venue, then share the link with your best men and
          groomsmen.
        </p>
      </div>
      {retailers.length === 0 ? (
        <p className="text-sm text-[var(--color-stone-600)]">
          You&rsquo;ll need an existing relationship with an atelier first —{" "}
          <Link href="/dashboard" className="underline underline-offset-4">
            visit your dashboard
          </Link>{" "}
          to find yours.
        </p>
      ) : (
        <NewWeddingPartyForm retailers={retailers} />
      )}
    </div>
  );
}
