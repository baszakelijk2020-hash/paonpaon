import { CorporateOfficeVisitRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { notFound } from "next/navigation";

import { OfficeVisitRequestForm } from "./request-form";
import { VisitSlotPicker } from "./slot-picker";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The corporate office-visit landing page (PHASE 18.4 / BD-104) —
 * company-branded, publicly reachable, and deliberately narrow: it
 * shows only the account/programme name (never other clients, never
 * margins, never a wearer's own data). Self-service slot booking (direct
 * founder instruction, 2026-08-19) is now the primary path when the
 * retailer has defined open slots for this programme; the original
 * leave-a-request form remains the fallback when there are none, so a
 * programme with no defined slot pool still collects a real lead rather
 * than showing an empty page.
 */
export default async function CorporateOfficeVisitPage({
  params,
}: {
  params: Promise<{ slug: string; programmeId: string }>;
}) {
  const { programmeId } = await params;
  const supabase = await getSupabaseServerClient();
  const repo = new CorporateOfficeVisitRepository(supabase);

  const reveal = await repo
    .resolvePage(asId<"CorporateProgrammeId">(programmeId))
    .catch(() => null);
  if (!reveal) notFound();

  const openSlots = await repo.listOpenSlots(
    asId<"CorporateProgrammeId">(programmeId),
  );

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
        {openSlots.length > 0 ? (
          <VisitSlotPicker slots={openSlots} />
        ) : (
          <OfficeVisitRequestForm programmeId={programmeId} />
        )}
      </Card>
    </main>
  );
}
