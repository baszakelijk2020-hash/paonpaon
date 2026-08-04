import { CorporateOpportunityRepository } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import Link from "next/link";

import { createOpportunity } from "./actions";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STAGE_TONE = {
  identified: "neutral",
  qualified: "warning",
  tender_sent: "warning",
  won: "success",
  lost: "danger",
} as const;

const STAGE_LABEL = {
  identified: "Identified",
  qualified: "Qualified",
  tender_sent: "Tender sent",
  won: "Won",
  lost: "Lost",
} as const;

export default async function BusinessDevelopmentPage() {
  const session = await requireModuleSession("enterprise_verticals", "read");
  const repo = new CorporateOpportunityRepository(
    await getSupabaseServerClient(),
  );
  const opportunities = await repo.findByRetailer(session.retailerId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Business development
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          The corporate opportunity pipeline — identified through qualified,
          tender sent, won or lost. Every score is a plain sum of named,
          weighted signals: open an opportunity to see exactly which ones.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Pipeline
        </h2>
        {opportunities.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No opportunities yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {opportunities.map((opportunity) => (
              <li key={opportunity.id} className="py-2">
                <Link
                  href={`/business-development/${opportunity.id}`}
                  className="flex items-center justify-between gap-3 hover:underline"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-stone-900)]">
                      {opportunity.companyName}
                    </p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      Score {opportunity.score}
                    </p>
                  </div>
                  <Badge tone={STAGE_TONE[opportunity.stage]}>
                    {STAGE_LABEL[opportunity.stage]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <form action={createOpportunity} className="flex flex-col gap-3 pt-2">
          <FormField label="Company name" htmlFor="companyName">
            <Input id="companyName" name="companyName" required minLength={2} />
          </FormField>
          <Button type="submit" className="self-start">
            Add opportunity
          </Button>
        </form>
      </Card>
    </div>
  );
}
