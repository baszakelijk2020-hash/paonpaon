import { CorporateOpportunityRepository } from "@paon/database";
import {
  asId,
  checkOpportunityStageTransition,
  CORPORATE_OPPORTUNITY_SIGNAL_SOURCES,
  CORPORATE_OPPORTUNITY_STAGES,
  type CorporateOpportunityStage,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addSignal, transitionStage, winOpportunity } from "../actions";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STAGE_LABEL: Record<CorporateOpportunityStage, string> = {
  identified: "Identified",
  qualified: "Qualified",
  tender_sent: "Tender sent",
  won: "Won",
  lost: "Lost",
};

const SIGNAL_SOURCE_LABEL: Record<string, string> = {
  referral: "Referral",
  inbound_enquiry: "Inbound enquiry",
  event: "Event",
  existing_customer_link: "Existing customer link",
  staff_observation: "Staff observation",
  other: "Other",
};

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const session = await requireModuleSession("enterprise_verticals", "read");
  const repo = new CorporateOpportunityRepository(
    await getSupabaseServerClient(),
  );
  const opportunity = await repo.findById(
    asId<"CorporateOpportunityId">(opportunityId),
  );
  if (!opportunity || opportunity.retailerId !== session.retailerId) {
    notFound();
  }
  const signals = await repo.listSignals(opportunity.id);

  const nextStages = CORPORATE_OPPORTUNITY_STAGES.filter(
    (stage) =>
      stage !== "won" &&
      checkOpportunityStageTransition({ from: opportunity.stage, to: stage })
        .ok,
  );
  const canWin = checkOpportunityStageTransition({
    from: opportunity.stage,
    to: "won",
  }).ok;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            {opportunity.companyName}
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            Score {opportunity.score} — the sum of the signals below, nothing
            hidden.
          </p>
        </div>
        <Badge tone={opportunity.stage === "won" ? "success" : "neutral"}>
          {STAGE_LABEL[opportunity.stage]}
        </Badge>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Signals
        </h2>
        {signals.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No signals recorded yet — the score stays at zero until one is.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {signals.map((signal) => (
              <li key={signal.id} className="py-2">
                <p className="text-sm font-medium text-[var(--color-stone-900)]">
                  {SIGNAL_SOURCE_LABEL[signal.source] ?? signal.source}
                </p>
                <p className="text-xs text-[var(--color-stone-500)]">
                  {signal.detail}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form action={addSignal} className="flex flex-col gap-3 pt-2">
          <input type="hidden" name="opportunityId" value={opportunity.id} />
          <FormField label="Source" htmlFor="source">
            <Select id="source" name="source" required defaultValue="other">
              {CORPORATE_OPPORTUNITY_SIGNAL_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {SIGNAL_SOURCE_LABEL[source] ?? source}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Detail" htmlFor="detail">
            <textarea
              id="detail"
              name="detail"
              required
              minLength={3}
              maxLength={2000}
              className="min-h-20 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-sm"
              placeholder="What happened, and why it points to a real opportunity."
            />
          </FormField>
          <Button type="submit" className="self-start">
            Add signal
          </Button>
        </form>
      </Card>

      {opportunity.stage !== "won" && opportunity.stage !== "lost" ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Move the opportunity
          </h2>
          <div className="flex flex-wrap gap-2">
            {nextStages.map((stage) => (
              <form key={stage} action={transitionStage}>
                <input
                  type="hidden"
                  name="opportunityId"
                  value={opportunity.id}
                />
                <input type="hidden" name="to" value={stage} />
                <Button type="submit" variant="secondary">
                  {STAGE_LABEL[stage]}
                </Button>
              </form>
            ))}
          </div>
          {canWin ? (
            <form
              action={winOpportunity}
              className="flex flex-col gap-3 border-t border-[var(--color-stone-200)] pt-4"
            >
              <input
                type="hidden"
                name="opportunityId"
                value={opportunity.id}
              />
              <FormField
                label="Account reference (creates the corporate account)"
                htmlFor="accountReference"
              >
                <Input id="accountReference" name="accountReference" required />
              </FormField>
              <Button type="submit" className="self-start">
                Win — create corporate account
              </Button>
            </form>
          ) : null}
        </Card>
      ) : opportunity.linkedAccountId ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          Won — see the{" "}
          <Link href="/corporate" className="underline">
            corporate account
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
