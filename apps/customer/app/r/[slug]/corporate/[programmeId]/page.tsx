import { CorporateOfficeVisitRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { notFound } from "next/navigation";

import { OfficeVisitRequestForm } from "./request-form";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The corporate office-visit landing page (PHASE 18.4 / BD-104) —
 * company-branded, publicly reachable, and deliberately narrow: it
 * shows only the account/programme name (never other clients, never
 * margins, never a wearer's own data) and collects a visit request into
 * the staff-reviewed intake queue. Turning a request into a scheduled
 * fitting slot against real capacity is 18.6's own item.
 */
export default async function CorporateOfficeVisitPage({
  params,
}: {
  params: Promise<{ slug: string; programmeId: string }>;
}) {
  const { programmeId } = await params;
  const supabase = await getSupabaseServerClient();

  const reveal = await new CorporateOfficeVisitRepository(supabase)
    .resolvePage(asId<"CorporateProgrammeId">(programmeId))
    .catch(() => null);
  if (!reveal) notFound();

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        {reveal.retailerDisplayName}
      </p>
      <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
        {reveal.companyName}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-stone-500)]">
        {reveal.programmeName}
      </p>

      <Card className="mt-6">
        <OfficeVisitRequestForm programmeId={programmeId} />
      </Card>
    </main>
  );
}
