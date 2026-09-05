import { ConceptScanRepository, RetailerRepository } from "@paon/database";
import { CONCEPT_SCAN_KIND_LABELS } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { notFound } from "next/navigation";

import { submitConceptSelection } from "./actions";
import { ManualCodeEntryForm } from "./manual-code-entry-form";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ConceptsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { slug } = await params;
  const { sent } = await searchParams;
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") notFound();

  const session = await getSession();
  const isSignedIn = !!session && session.accountType === "customer";

  const draft = isSignedIn
    ? await new ConceptScanRepository(supabase).findDraftSelectionForCustomer(
        retailer.id,
      )
    : null;

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        {retailer.displayName}
      </p>
      <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
        Concept order
      </h1>
      <p className="mt-1 text-sm text-[var(--color-stone-500)]">
        Enter the code from any Try-On or fabric swatch tag to add it to your
        concept list, then send everything to your advisor at once.
      </p>

      {sent === "1" ? (
        <p
          role="status"
          className="mt-4 text-sm font-medium text-[var(--color-stone-700)]"
        >
          Sent to your advisor.
        </p>
      ) : null}

      <Card className="mt-6">
        <ManualCodeEntryForm slug={slug} />
      </Card>

      {isSignedIn ? (
        <Card className="mt-6 flex flex-col gap-3">
          <h2 className="text-lg font-medium">Your concept list</h2>
          {!draft || draft.items.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              Nothing added yet.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {draft.items.map((item) => (
                  <li
                    key={item.scanCodeId}
                    className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                  >
                    {CONCEPT_SCAN_KIND_LABELS[item.kind]}
                    {" — "}
                    {item.productName}
                    {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                  </li>
                ))}
              </ul>
              <form action={submitConceptSelection}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="selectionId" value={draft.id} />
                <Button type="submit">Send to my advisor</Button>
              </form>
            </>
          )}
        </Card>
      ) : null}
    </main>
  );
}
