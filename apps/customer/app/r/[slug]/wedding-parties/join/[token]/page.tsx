import { RetailerRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { notFound } from "next/navigation";

import { JoinForm } from "./join-form";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/** Public, no session required — the whole point of a groom-shareable
 * invite link (ADR: wedding-party invite links) is that a party
 * member can join before ever having an account. The token itself is
 * validated inside `join_wedding_party`, not here. */
export default async function JoinWeddingPartyPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") notFound();

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="mb-1 text-xs font-[var(--font-accent)] font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        {retailer.displayName}
      </p>
      <h1 className="mb-2 text-3xl font-[var(--font-display)] text-[var(--color-stone-900)]">
        You&rsquo;re invited
      </h1>
      <p className="mb-6 text-sm text-[var(--color-stone-500)]">
        Join the wedding party — a few details and the team will take it from
        here.
      </p>
      <Card>
        <JoinForm token={token} />
      </Card>
    </main>
  );
}
