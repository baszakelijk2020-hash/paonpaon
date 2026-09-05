import { ConceptScanRepository, RetailerRepository } from "@paon/database";
import { CONCEPT_SCAN_KIND_LABELS } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToSelectionForm } from "./add-to-selection-form";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * FT-03's per-item reveal — the page both a scanned QR and the manual
 * code-entry form land on. Anonymous by design (same non-goal as the
 * gift/wardrobe reveal pages): full item information, never a customer
 * identity. Named states per the blueprint: unknown, expired, recalled,
 * wrong House (the code's real retailer differs from the one being
 * browsed) and resolved.
 */
export default async function ConceptScanRevealPage({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") notFound();

  const reveal = await new ConceptScanRepository(supabase).resolveCode(code);
  const session = await getSession();
  const isSignedIn = !!session && session.accountType === "customer";

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        {retailer.displayName}
      </p>
      <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
        Concept order
      </h1>

      <Card className="mt-6 flex flex-col gap-4">
        {reveal.status === "unknown" ? (
          <p role="status" className="text-sm text-[var(--color-stone-700)]">
            We couldn&apos;t find this code. Check it and try again, or ask a
            member of the team.
          </p>
        ) : reveal.status === "recalled" ? (
          <p role="status" className="text-sm text-[var(--color-stone-700)]">
            This tag has been recalled and is no longer active.
          </p>
        ) : reveal.status === "expired" ? (
          <p role="status" className="text-sm text-[var(--color-stone-700)]">
            This code has expired.
          </p>
        ) : reveal.retailerSlug && reveal.retailerSlug !== slug ? (
          <div>
            <p role="status" className="text-sm text-[var(--color-stone-700)]">
              This code belongs to a different House.
            </p>
            <Link
              href={`/r/${reveal.retailerSlug}/concepts/${code}`}
              className="mt-2 inline-block text-sm underline"
            >
              Open it at {reveal.retailerDisplayName}
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
              {CONCEPT_SCAN_KIND_LABELS[reveal.kind ?? "try_on"]}
            </p>
            <h2 className="text-xl text-[var(--color-stone-900)]">
              {reveal.productName}
            </h2>
            {reveal.variantLabel ? (
              <p className="text-sm text-[var(--color-stone-500)]">
                {reveal.variantLabel}
              </p>
            ) : null}
            {reveal.primaryImageUrl ? (
              <Image
                src={reveal.primaryImageUrl}
                alt={reveal.productName ?? ""}
                width={400}
                height={400}
                className="w-full rounded-[var(--radius-md)] object-cover"
              />
            ) : null}
            {reveal.price ? (
              <p className="text-sm text-[var(--color-stone-900)]">
                {formatMoney(reveal.price, "en-US")}
              </p>
            ) : null}

            {isSignedIn ? (
              <AddToSelectionForm
                slug={slug}
                retailerId={retailer.id}
                code={code}
              />
            ) : (
              <Link
                href={`/login?redirectTo=${encodeURIComponent(`/r/${slug}/concepts/${code}`)}`}
                className="rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-4 py-2 text-center text-sm text-white hover:bg-[var(--color-stone-800)]"
              >
                Sign in to add to your concept list
              </Link>
            )}
          </>
        )}
      </Card>
    </main>
  );
}
