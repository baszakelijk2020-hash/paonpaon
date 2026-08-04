import { CorporateTenderRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { notFound } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function TenderRevealPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { token } = await params;
  const supabase = await getSupabaseServerClient();

  const reveal = await new CorporateTenderRepository(supabase)
    .resolvePublic(token)
    .catch(() => null);
  if (!reveal) notFound();

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        {reveal.retailerDisplayName}
      </p>
      <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
        {reveal.tenderTitle}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-stone-500)]">
        Prepared for {reveal.companyName}
      </p>

      <Card className="mt-6">
        {reveal.status === "revoked" ? (
          <p className="text-sm text-[var(--color-stone-700)]" role="status">
            This link has been revoked and no longer resolves. Reach out to{" "}
            {reveal.retailerDisplayName} for a current one.
          </p>
        ) : reveal.status === "not_published" ? (
          <p className="text-sm text-[var(--color-stone-700)]" role="status">
            This tender is not yet published. Reach out to{" "}
            {reveal.retailerDisplayName} for an update.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {reveal.conceptImageUrls && reveal.conceptImageUrls.length > 0 ? (
              <div className="flex flex-col gap-2" data-concept-images>
                {reveal.conceptImageUrls.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element -- external, ai-generated URL, not part of the optimized catalogue image pipeline
                  <img
                    key={url}
                    src={url}
                    alt="Tender concept"
                    className="w-full rounded-[var(--radius-md)]"
                  />
                ))}
              </div>
            ) : null}
            <p className="text-sm text-[var(--color-stone-700)]">
              {reveal.summary}
            </p>
            {reveal.garmentConcepts && reveal.garmentConcepts.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {reveal.garmentConcepts.map((concept) => (
                  <li
                    key={concept}
                    className="text-sm text-[var(--color-stone-900)]"
                  >
                    {concept}
                  </li>
                ))}
              </ul>
            ) : null}
            {reveal.pricingNote ? (
              <p className="text-sm text-[var(--color-stone-500)]">
                {reveal.pricingNote}
              </p>
            ) : null}
            <p className="text-xs text-[var(--color-stone-400)]">
              Version {reveal.version}
            </p>
          </div>
        )}
      </Card>
    </main>
  );
}
