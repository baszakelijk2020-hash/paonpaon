import { WardrobeRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * QR wardrobe card's physical-to-digital bridge (PHASE 17.13 / ADV-113).
 * Anonymous by design — a hanger tag can be scanned by anyone, so this
 * shows the garment's own real information only, never the owning
 * customer's identity. Managing the item (retire, ask an advisor, log
 * care) already lives in the full authenticated wardrobe dashboard at
 * `/wardrobe`; this page deep-links there rather than duplicating those
 * actions on an anonymous surface.
 */
export default async function WardrobeItemRevealPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const supabase = await getSupabaseServerClient();

  const reveal = await new WardrobeRepository(supabase)
    .resolvePublicItem(token)
    .catch(() => null);
  if (!reveal) notFound();

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        {reveal.retailerDisplayName}
      </p>
      <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
        {reveal.brand ? `${reveal.brand} ` : ""}
        {reveal.displayName}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-stone-500)]">
        {reveal.categoryCode.replaceAll("_", " ")}
      </p>

      <Card className="mt-6 flex flex-col gap-4">
        {reveal.retired ? (
          <p
            role="status"
            className="text-sm font-medium text-[var(--color-stone-500)]"
          >
            This piece has been retired from active wear.
          </p>
        ) : null}

        {reveal.identifyingPhotoUrl ? (
          <Image
            src={reveal.identifyingPhotoUrl}
            alt={reveal.displayName}
            width={400}
            height={400}
            className="w-full rounded-[var(--radius-md)] object-cover"
          />
        ) : null}

        {reveal.description ? (
          <p className="text-sm text-[var(--color-stone-700)]">
            {reveal.description}
          </p>
        ) : null}

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-[var(--color-stone-500)]">Condition</dt>
          <dd className="text-[var(--color-stone-900)]">
            {reveal.condition.replaceAll("_", " ")}
          </dd>
          <dt className="text-[var(--color-stone-500)]">Care</dt>
          <dd className="text-[var(--color-stone-900)]">
            {reveal.careState.replaceAll("_", " ")}
          </dd>
        </dl>

        {reveal.productSlug ? (
          <Link
            href={`/r/${slug}/products/${reveal.productSlug}`}
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-300)] px-4 py-2 text-center text-sm hover:bg-[var(--color-stone-50)]"
          >
            Shop this piece
          </Link>
        ) : null}

        <Link
          href={`/login?redirectTo=${encodeURIComponent("/wardrobe")}`}
          className="rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-4 py-2 text-center text-sm text-white hover:bg-[var(--color-stone-800)]"
        >
          Recognize this item? Sign in to manage it
        </Link>
      </Card>
    </main>
  );
}
