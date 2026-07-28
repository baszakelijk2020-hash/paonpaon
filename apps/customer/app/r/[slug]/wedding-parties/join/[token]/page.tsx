import { RetailerRepository, WeddingPartyRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import { notFound } from "next/navigation";

import { JoinForm } from "./join-form";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/** Public, no session required — the whole point of a groom-shareable
 * invite link (ADR: wedding-party invite links) is that a party
 * member can join before ever having an account. Preview uses
 * `preview_wedding_party_invite`; join still goes through
 * `join_wedding_party`. */
export default async function JoinWeddingPartyPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") notFound();

  let preview: Awaited<
    ReturnType<WeddingPartyRepository["previewInvite"]>
  > | null = null;
  try {
    preview = await new WeddingPartyRepository(supabase).previewInvite(token);
  } catch {
    notFound();
  }
  if (preview.retailerSlug !== slug) notFound();

  const when = [
    preview.eventDate ? formatDate(preview.eventDate, "en-US") : null,
    preview.eventTime ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="font-accent mb-1 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        {preview.retailerName}
      </p>
      <h1 className="font-display mb-2 text-3xl text-[var(--color-stone-900)]">
        You&rsquo;re invited
      </h1>
      <p className="mb-4 text-sm text-[var(--color-stone-500)]">
        Join the wedding party — name, contact, a photo, and your height and
        weight so the atelier can prepare sample garments before you arrive.
      </p>
      {when || preview.fittingLocation || preview.venueName ? (
        <Card className="mb-6 space-y-1 text-sm text-[var(--color-stone-700)]">
          {when ? <p>{when}</p> : null}
          {preview.fittingLocation ? (
            <p>Fitting at {preview.fittingLocation}</p>
          ) : null}
          {preview.venueName ? <p>Ceremony · {preview.venueName}</p> : null}
        </Card>
      ) : null}
      <Card>
        <JoinForm token={token} />
      </Card>
    </main>
  );
}
