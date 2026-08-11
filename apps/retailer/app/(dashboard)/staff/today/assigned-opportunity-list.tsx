"use client";

import type { ClientelingOpportunity } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import {
  completeAssignedOpportunity,
  type CompleteAssignedOpportunityResult,
} from "./actions";

function AssignedOpportunity({
  opportunity,
}: {
  readonly opportunity: ClientelingOpportunity;
}) {
  const [state, action, pending] = useActionState<
    CompleteAssignedOpportunityResult | undefined,
    FormData
  >(completeAssignedOpportunity, undefined);

  return (
    <li className="flex items-start justify-between gap-4 border-b border-[var(--color-stone-100)] pb-4 last:border-0">
      <div>
        <p className="text-sm font-medium text-[var(--color-stone-900)]">
          {opportunity.whyNow}
        </p>
        <p className="mt-1 text-sm text-[var(--color-stone-600)]">
          {opportunity.suggestedAction}
        </p>
        {state?.status === "unavailable" ? (
          <p
            role="status"
            className="mt-2 text-sm text-[var(--color-stone-500)]"
          >
            This opportunity is no longer available.
          </p>
        ) : null}
      </div>
      <form action={action}>
        <input type="hidden" name="opportunityId" value={opportunity.id} />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Completing…" : "Complete"}
        </Button>
      </form>
    </li>
  );
}

export function AssignedOpportunityList({
  opportunities,
}: {
  readonly opportunities: readonly ClientelingOpportunity[];
}) {
  return (
    <Card>
      <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
        My Customer Opportunities ({opportunities.length})
      </h2>
      {opportunities.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-4">
          {opportunities.map((opportunity) => (
            <AssignedOpportunity
              key={opportunity.id}
              opportunity={opportunity}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-stone-500)]">
          No customer opportunities are assigned to you right now.
        </p>
      )}
    </Card>
  );
}
