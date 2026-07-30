import { requireRetailerRole } from "@paon/auth";
import { SourceAuthorityRepository } from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import { redirect } from "next/navigation";

import { ConnectionsPanel } from "./connections-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ConnectionsSettingsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const repository = new SourceAuthorityRepository(supabase);
  const overview = await repository.getRetailerOverview(session.retailerId);
  const policies = await repository.getAuthorityPolicies(session.retailerId);
  const openConflicts = await repository.listOpenConflicts(session.retailerId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Source connections
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Authority by domain, connector health, and external deep links. Live
          provider credentials are optional — the Faden fixture exercises
          read-only ingest without write-back.
        </p>
      </div>

      {openConflicts.length > 0 ? (
        <Card className="border-[var(--color-warning-200)] bg-[var(--color-warning-50)]">
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Open reconciliation conflicts
          </h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm text-[var(--color-stone-700)]">
            {openConflicts.map((conflict) => (
              <li key={conflict.id}>
                {conflict.state}: {conflict.conflictReason ?? "Review required"}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Authority policies
        </h2>
        {policies.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No authority policies configured yet. Run the Faden fixture to seed
            production/order_status co-managed ingest.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {policies.map((policy) => (
              <li
                key={policy.id}
                className="flex flex-wrap items-center gap-2 border-b border-[var(--color-stone-100)] py-2"
              >
                <span>
                  {policy.domain}/{policy.fieldGroup}
                </span>
                <Badge tone="neutral">{policy.authorityMode}</Badge>
                <span className="text-xs text-[var(--color-stone-500)]">
                  directions: {policy.allowedDirections.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConnectionsPanel overview={overview} />
    </div>
  );
}
