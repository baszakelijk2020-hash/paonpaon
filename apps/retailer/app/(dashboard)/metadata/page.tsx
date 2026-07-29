import { requireRetailerRole } from "@paon/auth";
import { MetadataRepository, ProductRepository } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { redirect } from "next/navigation";

import {
  ConceptOverrideForm,
  CreateLocalConceptForm,
  PendingAssignmentCard,
  ProposeAssignmentForm,
} from "./metadata-review-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function MetadataReviewPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const metadata = new MetadataRepository(supabase);
  const [concepts, pending, recent, overrides, products] = await Promise.all([
    metadata.findVisibleConcepts(session.retailerId),
    metadata.findAssignmentsForReview(session.retailerId, "pending"),
    metadata.findAssignmentsForReview(session.retailerId),
    metadata.findOverrides(session.retailerId),
    new ProductRepository(supabase).findByRetailer(session.retailerId),
  ]);

  const conceptsById = new Map(
    concepts.map((concept) => [concept.id, concept]),
  );
  const reviewed = recent.filter(
    (assignment) => assignment.reviewStatus !== "pending",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
          Catalogue intelligence
        </p>
        <h1 className="font-display mt-2 text-4xl text-[var(--color-stone-900)]">
          Metadata review
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
          Propose tenant assignments, review pending evidence, and adjust local
          presentation. Canonical PAON concepts stay platform-owned.
        </p>
      </div>

      <section aria-labelledby="pending-review-heading" className="grid gap-4">
        <div>
          <h2
            id="pending-review-heading"
            className="font-display text-3xl text-[var(--color-stone-900)]"
          >
            Pending review
          </h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            {pending.length} assignment{pending.length === 1 ? "" : "s"} waiting
          </p>
        </div>
        {pending.length === 0 ? (
          <Card className="border-dashed py-14 text-center">
            <p className="font-display text-2xl">No pending assignments.</p>
            <p className="mt-2 text-sm text-[var(--color-stone-500)]">
              Supplier and AI proposals will appear here until a manager accepts
              or rejects them.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pending.map((assignment) => (
              <PendingAssignmentCard
                key={assignment.id}
                assignment={assignment}
                concept={conceptsById.get(assignment.conceptId)}
              />
            ))}
          </div>
        )}
      </section>

      <ProposeAssignmentForm concepts={concepts} products={products} />
      <CreateLocalConceptForm />
      <ConceptOverrideForm concepts={concepts} existing={overrides[0]} />

      <section aria-labelledby="overrides-heading" className="grid gap-4">
        <div>
          <h2
            id="overrides-heading"
            className="font-display text-3xl text-[var(--color-stone-900)]"
          >
            Local overrides
          </h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            {overrides.length} override{overrides.length === 1 ? "" : "s"}
          </p>
        </div>
        {overrides.length === 0 ? (
          <Card className="border-dashed py-10 text-center">
            <p className="text-sm text-[var(--color-stone-500)]">
              No local presentation overrides yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {overrides.map((override) => {
              const concept = conceptsById.get(override.conceptId);
              return (
                <Card key={override.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={override.isHidden ? "warning" : "neutral"}>
                      {override.isHidden ? "Hidden" : "Visible"}
                    </Badge>
                    <span className="font-medium text-[var(--color-stone-900)]">
                      {override.displayName ??
                        concept?.canonicalName ??
                        override.conceptId}
                    </span>
                    {concept ? (
                      <span className="text-sm text-[var(--color-stone-500)]">
                        {kindLabel(concept.kind)}
                      </span>
                    ) : null}
                  </div>
                  {override.summaryOverride ? (
                    <p className="mt-2 text-sm text-[var(--color-stone-600)]">
                      {override.summaryOverride}
                    </p>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="recent-reviews-heading" className="grid gap-4">
        <div>
          <h2
            id="recent-reviews-heading"
            className="font-display text-3xl text-[var(--color-stone-900)]"
          >
            Recent decisions
          </h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            Accepted and rejected assignments retain actor, time, source, and
            evidence.
          </p>
        </div>
        {reviewed.length === 0 ? (
          <Card className="border-dashed py-10 text-center">
            <p className="text-sm text-[var(--color-stone-500)]">
              No completed reviews yet.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-[var(--color-stone-100)] overflow-hidden p-0">
            {reviewed.slice(0, 20).map((assignment) => {
              const concept = conceptsById.get(assignment.conceptId);
              return (
                <div key={assignment.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        assignment.reviewStatus === "accepted"
                          ? "success"
                          : "danger"
                      }
                    >
                      {assignment.reviewStatus}
                    </Badge>
                    <span className="text-sm text-[var(--color-stone-700)]">
                      {concept
                        ? `${kindLabel(concept.kind)} · ${concept.canonicalName}`
                        : assignment.conceptId}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                    {assignment.source}
                    {assignment.supplierValue
                      ? ` · raw “${assignment.supplierValue}”`
                      : ""}
                    {assignment.reviewedAt
                      ? ` · ${new Date(assignment.reviewedAt).toLocaleString()}`
                      : ""}
                  </p>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}

function kindLabel(kind: string): string {
  return kind.replaceAll("_", " ");
}
