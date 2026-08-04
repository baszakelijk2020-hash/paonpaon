import {
  CorporateConceptAssetRepository,
  CorporateOpportunityRepository,
  CorporateProjectRepository,
  CorporateTenderRepository,
  CustomerFactRepository,
  CustomerRepository,
  RetailerRepository,
} from "@paon/database";
import {
  asId,
  assessProjectStall,
  checkOpportunityStageTransition,
  CORPORATE_OPPORTUNITY_SIGNAL_SOURCES,
  CORPORATE_OPPORTUNITY_STAGES,
  nextProjectStage,
  type CorporateOpportunityStage,
  type CorporateProjectStage,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addSignal,
  advanceProjectStage,
  approveTenderVersion,
  createTender,
  createTenderVersion,
  decideConceptAsset,
  generateConceptImages,
  transitionStage,
  winOpportunity,
} from "../actions";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STAGE_LABEL: Record<CorporateOpportunityStage, string> = {
  identified: "Identified",
  qualified: "Qualified",
  tender_sent: "Tender sent",
  won: "Won",
  lost: "Lost",
};

const PROJECT_STAGE_LABEL: Record<CorporateProjectStage, string> = {
  opportunity: "Opportunity",
  tender: "Tender",
  award: "Award",
  design_approval: "Design approval",
  sample_approval: "Sample approval",
  material_approval: "Material approval",
  employee_import: "Employee import",
  fitting: "Fitting",
  production: "Production",
  qc: "QC",
  distribution: "Distribution",
  launch: "Launch",
  renewal: "Renewal",
};

// PHASE 18.7: opportunity -> tender and tender -> award fire
// automatically elsewhere (authoring a tender, winning the
// opportunity) — no manual button is offered for those two so a stage
// can never be claimed without the real event it represents.
const MANUALLY_ADVANCEABLE_STAGES: ReadonlySet<CorporateProjectStage> = new Set(
  [
    "award",
    "design_approval",
    "sample_approval",
    "material_approval",
    "employee_import",
    "fitting",
    "production",
    "qc",
    "distribution",
    "launch",
  ],
);

const SIGNAL_SOURCE_LABEL: Record<string, string> = {
  referral: "Referral",
  inbound_enquiry: "Inbound enquiry",
  event: "Event",
  existing_customer_link: "Existing customer link",
  staff_observation: "Staff observation",
  public_signal: "Public signal",
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

  const projectRepo = new CorporateProjectRepository(
    await getSupabaseServerClient(),
  );
  const project = await projectRepo.findByOpportunity(opportunity.id);
  const projectEvents = project ? await projectRepo.listEvents(project.id) : [];
  const projectStall = project
    ? assessProjectStall({
        stage: project.stage,
        stageEnteredAt: project.stageEnteredAt,
        now: new Date(),
      })
    : null;
  const projectNextStage = project ? nextProjectStage(project.stage) : null;
  const canManuallyAdvanceProject =
    project !== null &&
    projectNextStage !== null &&
    MANUALLY_ADVANCEABLE_STAGES.has(project.stage);

  // PHASE 18.12: existing-customer cross-reference, scoped to this
  // retailer only. Never auto-added — a match is only ever a suggestion
  // until a person confirms it with "Add as signal" below.
  const client = await getSupabaseServerClient();
  const employerMatches = await new CustomerFactRepository(
    client,
  ).findByFactTypeAndValue(
    session.retailerId,
    "employer",
    opportunity.companyName,
  );
  const customerRepo = new CustomerRepository(client);
  const employerMatchesWithCustomer = (
    await Promise.all(
      employerMatches.map(async (fact) => ({
        fact,
        customer: await customerRepo.findById(fact.customerId),
      })),
    )
  ).filter(
    (
      m,
    ): m is {
      fact: (typeof employerMatches)[number];
      customer: NonNullable<typeof m.customer>;
    } => !!m.customer,
  );

  const tenderRepo = new CorporateTenderRepository(
    await getSupabaseServerClient(),
  );
  const conceptAssetRepo = new CorporateConceptAssetRepository(
    await getSupabaseServerClient(),
  );
  const tenders = await tenderRepo.findByOpportunity(opportunity.id);
  const tenderDetails = await Promise.all(
    tenders.map(async (tender) => {
      const versions = await tenderRepo.listVersions(tender.id);
      const conceptAssetsByVersion = await Promise.all(
        versions.map(async (version) => ({
          versionId: version.id,
          assets: await conceptAssetRepo.listByTenderVersion(version.id),
        })),
      );
      return {
        tender,
        versions,
        approvals: await tenderRepo.listApprovals(tender.id),
        conceptAssetsByVersion: new Map(
          conceptAssetsByVersion.map((v) => [v.versionId, v.assets]),
        ),
      };
    }),
  );
  const canCreateTender = opportunity.stage !== "lost";
  const retailer = await new RetailerRepository(
    await getSupabaseServerClient(),
  ).findById(session.retailerId);
  const customerAppBase = (
    process.env["NEXT_PUBLIC_CUSTOMER_APP_URL"] ?? "http://localhost:3002"
  ).replace(/\/$/, "");

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

      {project ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              Project lifecycle
            </h2>
            <div className="flex items-center gap-2">
              {projectStall?.stalled ? (
                <Badge tone="warning">
                  Stalled {projectStall.daysInStage}d (over{" "}
                  {projectStall.thresholdDays}d)
                </Badge>
              ) : null}
              <Badge tone="neutral">{PROJECT_STAGE_LABEL[project.stage]}</Badge>
            </div>
          </div>
          <p className="text-sm text-[var(--color-stone-500)]">
            {project.stage === "renewal"
              ? "Reached the end of the build lifecycle — ongoing renewal risk is tracked in the Analytics and renewal card below."
              : `${projectStall?.daysInStage ?? 0} day${
                  projectStall?.daysInStage === 1 ? "" : "s"
                } in this stage. Opportunity → tender and tender → award move automatically when a tender is authored or the opportunity is won.`}
          </p>
          {canManuallyAdvanceProject && projectNextStage ? (
            <form
              action={advanceProjectStage}
              className="flex flex-col gap-3 border-t border-[var(--color-stone-200)] pt-3"
            >
              <input
                type="hidden"
                name="opportunityId"
                value={opportunity.id}
              />
              <input type="hidden" name="to" value={projectNextStage} />
              <FormField
                label={`Note (optional) — why this is ready for ${PROJECT_STAGE_LABEL[projectNextStage]}`}
                htmlFor="projectAdvanceNote"
              >
                <Input id="projectAdvanceNote" name="note" maxLength={2000} />
              </FormField>
              <Button type="submit" variant="secondary" className="self-start">
                Advance to {PROJECT_STAGE_LABEL[projectNextStage]}
              </Button>
            </form>
          ) : null}
          {projectEvents.length > 0 ? (
            <ul className="flex flex-col gap-1 border-t border-[var(--color-stone-200)] pt-3 text-xs text-[var(--color-stone-500)]">
              {projectEvents.slice(0, 6).map((event) => (
                <li key={event.id}>
                  {event.fromStage
                    ? `${PROJECT_STAGE_LABEL[event.fromStage]} → ${
                        PROJECT_STAGE_LABEL[event.toStage]
                      }`
                    : `Started at ${PROJECT_STAGE_LABEL[event.toStage]}`}
                  {event.note ? ` — ${event.note}` : ""}
                  {event.staffId ? "" : " (automatic)"}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

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
                {signal.citationUrl ? (
                  <p className="break-all text-xs text-[var(--color-stone-400)]">
                    Source: {signal.citationUrl}
                  </p>
                ) : null}
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
          <FormField
            label="Citation URL (required for Public signal)"
            htmlFor="citationUrl"
            hint="A real, checkable source — never accepted on trust alone for a public signal."
          >
            <Input
              id="citationUrl"
              name="citationUrl"
              type="url"
              placeholder="https://…"
            />
          </FormField>
          <Button type="submit" className="self-start">
            Add signal
          </Button>
        </form>
      </Card>

      {employerMatchesWithCustomer.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Existing customer match
          </h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            {employerMatchesWithCustomer.length} of our own client
            {employerMatchesWithCustomer.length === 1 ? "" : "s"} list
            {employerMatchesWithCustomer.length === 1 ? "s" : ""}{" "}
            {opportunity.companyName} as their employer — a citable basis for an
            existing-customer-link signal, never added automatically.
          </p>
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {employerMatchesWithCustomer.map(({ fact, customer }) => (
              <li
                key={fact.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {customer.fullName}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    Lists employer: {fact.valueLabel}
                  </p>
                </div>
                <form action={addSignal}>
                  <input
                    type="hidden"
                    name="opportunityId"
                    value={opportunity.id}
                  />
                  <input
                    type="hidden"
                    name="source"
                    value="existing_customer_link"
                  />
                  <input
                    type="hidden"
                    name="detail"
                    value={`${customer.fullName} (existing client) lists "${fact.valueLabel}" as employer — customer fact ${fact.id}.`}
                  />
                  <Button type="submit" variant="secondary" size="sm">
                    Add as signal
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Tenders
        </h2>
        {tenderDetails.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No tender authored yet.
          </p>
        ) : (
          tenderDetails.map((tenderDetail) => {
            const { tender, versions, approvals, conceptAssetsByVersion } =
              tenderDetail;
            const approvedVersionIds = new Set(
              approvals.map((a) => a.tenderVersionId),
            );
            return (
              <div
                key={tender.id}
                className="flex flex-col gap-3 border-b border-[var(--color-stone-200)] pb-4 last:border-b-0 last:pb-0"
              >
                <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                  {tender.title}
                </h3>
                <p className="break-all text-xs text-[var(--color-stone-500)]">
                  Public link (shows only the latest approved version):{" "}
                  {customerAppBase}/r/{retailer?.slug}/tenders/
                  {tender.shareToken}
                </p>
                {versions.length === 0 ? (
                  <p className="text-xs text-[var(--color-stone-500)]">
                    No version authored yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {versions.map((version) => {
                      const approved = approvedVersionIds.has(version.id);
                      return (
                        <li
                          key={version.id}
                          className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-[var(--color-stone-900)]">
                              Version {version.version}
                            </span>
                            <Badge tone={approved ? "success" : "neutral"}>
                              {approved ? "Approved" : "Not approved"}
                            </Badge>
                          </div>
                          <p className="text-xs text-[var(--color-stone-700)]">
                            {version.summary}
                          </p>
                          <ul className="list-disc pl-4 text-xs text-[var(--color-stone-500)]">
                            {version.garmentConcepts.map((concept) => (
                              <li key={concept}>{concept}</li>
                            ))}
                          </ul>
                          {(() => {
                            const conceptAssets =
                              conceptAssetsByVersion.get(version.id) ?? [];
                            return (
                              <div className="flex flex-col gap-2 border-t border-[var(--color-stone-200)] pt-2">
                                <p className="text-xs font-medium text-[var(--color-stone-700)]">
                                  Concept images
                                </p>
                                {conceptAssets.length === 0 ? (
                                  <p className="text-xs text-[var(--color-stone-500)]">
                                    None generated yet.
                                  </p>
                                ) : (
                                  <ul className="flex flex-col gap-2">
                                    {conceptAssets.map((asset) => (
                                      <li
                                        key={asset.id}
                                        className="flex items-center justify-between gap-2"
                                      >
                                        <Badge
                                          tone={
                                            asset.status === "approved"
                                              ? "success"
                                              : asset.status === "rejected"
                                                ? "danger"
                                                : "neutral"
                                          }
                                        >
                                          {asset.status === "approved"
                                            ? "Approved"
                                            : asset.status === "rejected"
                                              ? "Rejected"
                                              : "Pending approval"}
                                        </Badge>
                                        {asset.status === "pending_approval" ? (
                                          <div className="flex gap-2">
                                            <form action={decideConceptAsset}>
                                              <input
                                                type="hidden"
                                                name="opportunityId"
                                                value={opportunity.id}
                                              />
                                              <input
                                                type="hidden"
                                                name="assetId"
                                                value={asset.id}
                                              />
                                              <input
                                                type="hidden"
                                                name="decision"
                                                value="approved"
                                              />
                                              <Button
                                                type="submit"
                                                variant="secondary"
                                                size="sm"
                                              >
                                                Approve image
                                              </Button>
                                            </form>
                                            <form action={decideConceptAsset}>
                                              <input
                                                type="hidden"
                                                name="opportunityId"
                                                value={opportunity.id}
                                              />
                                              <input
                                                type="hidden"
                                                name="assetId"
                                                value={asset.id}
                                              />
                                              <input
                                                type="hidden"
                                                name="decision"
                                                value="rejected"
                                              />
                                              <Button
                                                type="submit"
                                                variant="secondary"
                                                size="sm"
                                              >
                                                Reject
                                              </Button>
                                            </form>
                                          </div>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                <form
                                  action={generateConceptImages}
                                  className="self-start"
                                >
                                  <input
                                    type="hidden"
                                    name="opportunityId"
                                    value={opportunity.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="tenderVersionId"
                                    value={version.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="tenderTitle"
                                    value={tender.title}
                                  />
                                  <input
                                    type="hidden"
                                    name="garmentConcepts"
                                    value={version.garmentConcepts.join("\n")}
                                  />
                                  <Button
                                    type="submit"
                                    variant="secondary"
                                    size="sm"
                                  >
                                    Generate concept images
                                  </Button>
                                </form>
                              </div>
                            );
                          })()}
                          {!approved ? (
                            <form
                              action={approveTenderVersion}
                              className="self-start pt-1"
                            >
                              <input
                                type="hidden"
                                name="opportunityId"
                                value={opportunity.id}
                              />
                              <input
                                type="hidden"
                                name="tenderVersionId"
                                value={version.id}
                              />
                              <Button
                                type="submit"
                                variant="secondary"
                                size="sm"
                              >
                                Approve
                              </Button>
                            </form>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <form
                  action={createTenderVersion}
                  className="flex flex-col gap-3 pt-2"
                >
                  <input
                    type="hidden"
                    name="opportunityId"
                    value={opportunity.id}
                  />
                  <input type="hidden" name="tenderId" value={tender.id} />
                  <FormField label="Summary" htmlFor={`summary-${tender.id}`}>
                    <textarea
                      id={`summary-${tender.id}`}
                      name="summary"
                      required
                      minLength={3}
                      maxLength={4000}
                      className="min-h-16 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-sm"
                    />
                  </FormField>
                  <FormField
                    label="Garment concepts (one per line)"
                    htmlFor={`garmentConcepts-${tender.id}`}
                  >
                    <textarea
                      id={`garmentConcepts-${tender.id}`}
                      name="garmentConcepts"
                      required
                      className="min-h-16 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-sm"
                    />
                  </FormField>
                  <FormField
                    label="Pricing note (optional)"
                    htmlFor={`pricingNote-${tender.id}`}
                  >
                    <Input id={`pricingNote-${tender.id}`} name="pricingNote" />
                  </FormField>
                  <Button
                    type="submit"
                    variant="secondary"
                    className="self-start"
                  >
                    Add version
                  </Button>
                </form>
              </div>
            );
          })
        )}
        {canCreateTender ? (
          <form
            action={createTender}
            className="flex flex-col gap-3 border-t border-[var(--color-stone-200)] pt-4"
          >
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <FormField label="Tender title" htmlFor="title">
              <Input id="title" name="title" required minLength={2} />
            </FormField>
            <Button type="submit" className="self-start">
              Start a tender
            </Button>
          </form>
        ) : null}
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
