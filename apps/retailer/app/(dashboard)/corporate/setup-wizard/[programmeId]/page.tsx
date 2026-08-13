import { CorporateRepository } from "@paon/database";
import { summarizeProgrammeReadiness } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addEmployee, saveRoles } from "../actions";

import { RolesStepForm } from "./roles-step-form";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STEPS = [
  { key: "roles", label: "Roles & entitlements" },
  { key: "employees", label: "Employees" },
  { key: "review", label: "Review" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

function StepIndicator({ current }: { current: StepKey }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);
  return (
    <nav className="flex items-center gap-2 text-sm">
      {STEPS.map((step, index) => (
        <div key={step.key} className="flex items-center gap-2">
          <span
            className={
              index === currentIndex
                ? "font-medium text-[var(--color-stone-900)]"
                : index < currentIndex
                  ? "text-[var(--color-stone-500)]"
                  : "text-[var(--color-stone-400)]"
            }
          >
            {index + 1}. {step.label}
          </span>
          {index < STEPS.length - 1 ? (
            <span className="text-[var(--color-stone-300)]">→</span>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

export default async function SetupWizardProgrammePage({
  params,
  searchParams,
}: {
  params: Promise<{ programmeId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { programmeId } = await params;
  const { step: rawStep } = await searchParams;
  const session = await requireModuleSession("enterprise_verticals", "read");
  const repo = new CorporateRepository(await getSupabaseServerClient());

  const programme = await repo.findProgrammeById(programmeId);
  if (!programme || programme.retailerId !== session.retailerId) {
    notFound();
  }

  const step: StepKey = STEPS.some((s) => s.key === rawStep)
    ? (rawStep as StepKey)
    : "roles";

  const latestVersion = await repo.findLatestEntitlementVersion(programmeId);

  if (step === "employees" && !latestVersion) {
    return (
      <div className="flex flex-col gap-6">
        <StepIndicator current="employees" />
        <Card>
          <p className="text-sm text-[var(--color-stone-700)]">
            Define roles and entitlements first.
          </p>
          <Link
            href={`/corporate/setup-wizard/${programmeId}?step=roles`}
            className="text-sm underline"
          >
            ← Back to roles
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          {programme.name}
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Guided setup — this programme is not finished until every step is
          complete.
        </p>
      </div>

      <StepIndicator current={step} />

      {step === "roles" ? (
        <Card>
          <RolesStepForm action={saveRoles.bind(null, programmeId)} />
        </Card>
      ) : null}

      {step === "employees" ? (
        <EmployeesStep
          programmeId={programmeId}
          repo={repo}
          siteKeys={programme.siteKeys}
          roleKeys={Array.from(
            new Set((latestVersion?.rules ?? []).map((rule) => rule.roleKey)),
          )}
        />
      ) : null}

      {step === "review" ? (
        <ReviewStep programmeId={programmeId} repo={repo} />
      ) : null}
    </div>
  );
}

async function EmployeesStep({
  programmeId,
  repo,
  siteKeys,
  roleKeys,
}: {
  programmeId: string;
  repo: CorporateRepository;
  siteKeys: readonly string[];
  roleKeys: string[];
}) {
  const wearers = await repo.findWearersByProgramme(programmeId);

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Employees added ({wearers.length})
        </h2>
        {wearers.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No employees yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {wearers.map((wearer) => (
              <li key={wearer.id} className="flex flex-col gap-1 py-2">
                <span className="text-sm font-medium text-[var(--color-stone-900)]">
                  {wearer.displayName}
                </span>
                <span className="text-xs text-[var(--color-stone-500)]">
                  {wearer.roleKey}
                  {wearer.siteKey ? ` · ${wearer.siteKey}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <form
          action={addEmployee.bind(null, programmeId)}
          className="flex flex-col gap-4"
        >
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Add an employee
          </h2>

          <FormField label="Full name" htmlFor="displayName">
            <Input id="displayName" name="displayName" required minLength={1} />
          </FormField>

          <FormField label="Employee reference" htmlFor="employeeReference">
            <Input
              id="employeeReference"
              name="employeeReference"
              required
              minLength={1}
            />
          </FormField>

          <FormField label="Role" htmlFor="roleKey">
            <Select id="roleKey" name="roleKey" required>
              {roleKeys.map((roleKey) => (
                <option key={roleKey} value={roleKey}>
                  {roleKey}
                </option>
              ))}
            </Select>
          </FormField>

          {siteKeys.length > 0 ? (
            <FormField label="Department or site" htmlFor="siteKey">
              <Select id="siteKey" name="siteKey">
                <option value="">— none —</option>
                {siteKeys.map((siteKey) => (
                  <option key={siteKey} value={siteKey}>
                    {siteKey}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          <FormField label="Joined on" htmlFor="joinedOn">
            <Input
              id="joinedOn"
              name="joinedOn"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
            />
          </FormField>

          <FormField
            label="Garment adaptation (optional)"
            htmlFor="garmentAdaptationNote"
            hint='Describe the garment fact only, e.g. "left sleeve +40mm" — never a reason or diagnosis.'
          >
            <Input id="garmentAdaptationNote" name="garmentAdaptationNote" />
          </FormField>

          <Button type="submit" className="self-start">
            Add employee
          </Button>
        </form>
      </Card>

      <Link
        href={`/corporate/setup-wizard/${programmeId}?step=review`}
        className={buttonVariants({ variant: "secondary" }) + " self-start"}
      >
        Continue to review →
      </Link>
    </div>
  );
}

async function ReviewStep({
  programmeId,
  repo,
}: {
  programmeId: string;
  repo: CorporateRepository;
}) {
  const [latestVersion, wearers, issues] = await Promise.all([
    repo.findLatestEntitlementVersion(programmeId),
    repo.findWearersByProgramme(programmeId),
    repo.findIssuesByProgramme(programmeId),
  ]);

  const issuesByWearer = new Map<string, typeof issues>();
  for (const issue of issues) {
    const list = issuesByWearer.get(issue.wearerId) ?? [];
    list.push(issue);
    issuesByWearer.set(issue.wearerId, list);
  }

  const readiness = summarizeProgrammeReadiness({
    wearers: wearers.map((wearer) => {
      const issued = (issuesByWearer.get(wearer.id) ?? []).length > 0;
      return {
        wearerId: wearer.id,
        fitted: false,
        ordered: issued,
        issued,
      };
    }),
  });

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Readiness
        </h2>
        <p className="text-sm text-[var(--color-stone-700)]">
          {readiness.wearerCount} wearer
          {readiness.wearerCount === 1 ? "" : "s"} · {readiness.issuedCount}{" "}
          issued at least one garment
        </p>
        {readiness.notStartedWearerIds.length > 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            Not started:{" "}
            {readiness.notStartedWearerIds
              .map(
                (wearerId) =>
                  wearers.find((wearer) => wearer.id === wearerId)
                    ?.displayName ?? wearerId,
              )
              .join(", ")}
          </p>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Entitlement rules
        </h2>
        {latestVersion ? (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {latestVersion.rules.map((rule, index) => (
              <li
                key={index}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="text-[var(--color-stone-900)]">
                  {rule.roleKey} — {rule.garmentKey}
                </span>
                <Badge>
                  {rule.quantity} / {rule.period}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-stone-500)]">
            No entitlement version yet.
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Employees
        </h2>
        <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
          {wearers.map((wearer) => (
            <li key={wearer.id} className="py-2 text-sm">
              {wearer.displayName} — {wearer.roleKey}
            </li>
          ))}
        </ul>
      </Card>

      <Link
        href={`/corporate/${programmeId}`}
        className={buttonVariants() + " self-start"}
      >
        Finish setup — go to programme →
      </Link>
    </div>
  );
}
