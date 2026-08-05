import {
  ClientelingOpportunityRepository,
  CustomerRepository,
} from "@paon/database";
import { matchStockNewsToPromises, retailerRoleAtLeast } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import Link from "next/link";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function PromiseMatchingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "sales_associate")) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Promise matching
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Not available for this role.
        </p>
      </div>
    );
  }
  const supabase = await getSupabaseServerClient();

  const opportunities = await new ClientelingOpportunityRepository(
    supabase,
  ).listForRetailer(session.retailerId);

  const matches = q
    ? matchStockNewsToPromises({
        stockUpdateText: q,
        candidates: opportunities.map((opportunity) => ({
          id: opportunity.id,
          type: opportunity.type,
          status: opportunity.status,
          whyNow: opportunity.whyNow,
          suggestedAction: opportunity.suggestedAction,
        })),
      })
    : [];

  const opportunityById = new Map(
    opportunities.map((opportunity) => [opportunity.id, opportunity]),
  );
  const customerRepo = new CustomerRepository(supabase);
  const matchDetails = await Promise.all(
    matches.map(async (match) => {
      const opportunity = opportunityById.get(match.opportunityId);
      if (!opportunity) return null;
      const customer = await customerRepo.findById(opportunity.customerId);
      return { match, opportunity, customer };
    }),
  );
  const visibleMatches = matchDetails.filter(
    (detail): detail is NonNullable<typeof detail> => detail !== null,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Promise matching
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Enter a stock update and see exactly which open promises to a client
          it might fulfil — a plain word match, every overlap shown, never a
          guess.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <FormField
            label="Stock update"
            htmlFor="q"
            hint='e.g. "New linen jackets arrived, sizes 40-44"'
          >
            <Input id="q" name="q" defaultValue={q ?? ""} required />
          </FormField>
          <Button type="submit" className="self-start">
            Find matching promises
          </Button>
        </form>
      </Card>

      {q ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            {visibleMatches.length === 0
              ? "No open promise mentions any of those words."
              : `${visibleMatches.length} open promise${visibleMatches.length === 1 ? "" : "s"} to check`}
          </h2>
          {visibleMatches.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {visibleMatches.map(({ match, opportunity, customer }) => (
                <li
                  key={opportunity.id}
                  className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--color-stone-900)]">
                      {customer?.fullName ?? "Client"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {match.overlappingWords.map((word) => (
                        <Badge key={word} tone="success">
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {opportunity.whyNow}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {customer?.email ? (
                      <a
                        href={`mailto:${customer.email}`}
                        className="text-sm underline underline-offset-4"
                      >
                        Email {customer.fullName.split(" ")[0]}
                      </a>
                    ) : null}
                    <Link
                      href={`/customers/${opportunity.customerId}`}
                      className="text-sm underline underline-offset-4"
                    >
                      Open relationship →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
