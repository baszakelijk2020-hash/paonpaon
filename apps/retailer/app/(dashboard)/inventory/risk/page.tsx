import {
  LossPreventionRepository,
  StockLedgerRepository,
} from "@paon/database";
import { type RiskRuleKind } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";

import {
  ApproveWriteOffForm,
  RecordSweepForm,
  RequestWriteOffForm,
  ResolveDiscrepancyForm,
  type Option,
} from "./risk-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Plain language for every rule. UX_PHILOSOPHY rule 1: a status is legible
 * without a click and is never an internal enum. Nobody says
 * "repeated_adjustment_same_variant" out loud.
 */
const RULE_LABEL: Record<RiskRuleKind, string> = {
  high_value_adjustment: "A lot of value in one write-off",
  repeated_adjustment_same_variant: "This item keeps being adjusted",
  adjustment_outside_count_session: "Written off with no stock count open",
  large_manual_discount: "An unusually large manual discount",
};

const DISCREPANCY_LABEL: Record<string, string> = {
  // Never "missing". A tag goes unread for a dozen mundane reasons, and
  // "missing" is a word that invites a write-off nobody counted.
  unobserved: "Expected here, not read",
  unexpected: "Read here, not expected",
};

/**
 * Loss prevention and the RFID pilot (PHASE 13.2 / INV-104, INV-105).
 *
 * Two things this page is careful about.
 *
 * A raised write-off has NOT happened. It sits in a queue until a manager who
 * did not raise it approves it, and only that approval writes the ledger
 * entry. So nothing here shows a pending write-off as though the stock had
 * already gone.
 *
 * And a sweep cannot move stock at all. It produces a list of disagreements
 * for a person to read, which is the only honest output of a reader that
 * misses tags for mundane reasons. There is no button on this page that turns
 * a sweep into a balance, because there is no such method to call.
 */
export default async function LossPreventionPage({
  searchParams,
}: {
  readonly searchParams?: Promise<{ readonly location?: string }>;
}) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const risk = new LossPreventionRepository(supabase);
  const ledger = new StockLedgerRepository(supabase);
  const resolved = (await searchParams) ?? {};

  const locations = await ledger.listLocations({
    retailerId: session.retailerId,
  });
  const activeLocationId = resolved.location ?? locations[0]?.id;

  const { data: variantRows } = await supabase
    .from("product_variants")
    .select("id, sku, size")
    .limit(50);
  const items: Option[] = (variantRows ?? []).map((variant) => ({
    id: variant.id,
    label: variant.size ? `${variant.sku} · ${variant.size}` : variant.sku,
  }));
  const locationOptions: Option[] = locations.map((location) => ({
    id: location.id,
    label: location.name,
  }));
  const locationNameById = new Map(
    locations.map((location) => [location.id, location.name]),
  );

  const [flags, discrepancies] = await Promise.all([
    risk.openFlags({ retailerId: session.retailerId }),
    risk.openDiscrepancies({ retailerId: session.retailerId }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Write-offs and sweeps.
        </h1>
        <p className="text-[var(--color-stone-600)]">
          Two signatures on anything valuable, and a reader that reports rather
          than decides.
        </p>
      </header>

      <section
        className="flex flex-col gap-4"
        data-open-flag-count={flags.length}
      >
        <div className="flex flex-col gap-1">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Waiting for a second signature ({flags.length})
          </h2>
          <p className="text-sm text-[var(--color-stone-600)]">
            None of these has happened yet. The stock only moves when someone
            other than the person who raised it approves it.
          </p>
        </div>

        {flags.length === 0 ? (
          <Card id="risk-no-flags" className="p-6">
            <p className="text-sm text-[var(--color-stone-600)]">
              Nothing is waiting. A write-off worth more than €500, or a third
              adjustment on the same item, will appear here for a manager to
              approve.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {flags.map((flag) => (
              <li key={flag.id}>
                <Card
                  className="flex flex-col gap-4 p-5"
                  data-risk-flag={flag.id}
                  data-flag-approved={flag.approved_at ? "true" : "false"}
                  data-flag-ledger-entry={flag.ledger_entry_id ?? ""}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm text-[var(--color-stone-900)]">
                        {locationNameById.get(flag.location_id) ??
                          "Unknown location"}
                      </span>
                      <span className="flex flex-wrap gap-2">
                        {(flag.triggered_rules as RiskRuleKind[]).map(
                          (rule) => (
                            <Badge key={rule} tone="warning">
                              {RULE_LABEL[rule] ?? rule}
                            </Badge>
                          ),
                        )}
                      </span>
                    </div>
                    {/* Said plainly, because "pending" reads as "done" to
                        somebody scanning a list quickly. */}
                    <Badge tone="neutral">Not written off yet</Badge>
                  </div>

                  <ApproveWriteOffForm
                    flagId={flag.id}
                    locationId={flag.location_id}
                    items={items}
                  />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-[family-name:var(--font-display)] text-lg">
              Raise a write-off
            </h2>
            <p className="text-sm text-[var(--color-stone-600)]">
              Nothing moves when you send this. It goes to a manager who was not
              involved.
            </p>
          </div>
          <RequestWriteOffForm items={items} locations={locationOptions} />
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-[family-name:var(--font-display)] text-lg">
              Record a reader sweep
            </h2>
            <p className="text-sm text-[var(--color-stone-600)]">
              A sweep never changes a stock figure. It tells you what disagrees
              with the ledger so someone can go and look.
            </p>
          </div>
          <RecordSweepForm locations={locationOptions} />
        </Card>
      </div>

      <section
        className="flex flex-col gap-4"
        data-open-discrepancy-count={discrepancies.length}
      >
        <div className="flex flex-col gap-1">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Disagreements to look into ({discrepancies.length})
          </h2>
          <p className="text-sm text-[var(--color-stone-600)]">
            Closing one needs a sentence about what you found. Without it,
            &ldquo;resolved&rdquo; cannot be told apart from
            &ldquo;ignored&rdquo; in a month&rsquo;s time.
          </p>
        </div>

        {discrepancies.length === 0 ? (
          <Card id="risk-no-discrepancies" className="p-6">
            <p className="text-sm text-[var(--color-stone-600)]">
              Nothing outstanding. Record a sweep above and anything that
              disagrees with the ledger will land here.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {discrepancies.map((discrepancy) => (
              <li key={discrepancy.id}>
                <Card
                  className="flex flex-col gap-3 p-5"
                  data-discrepancy={discrepancy.id}
                  data-discrepancy-kind={discrepancy.kind}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      tone={
                        discrepancy.kind === "unobserved"
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {DISCREPANCY_LABEL[discrepancy.kind] ?? discrepancy.kind}
                    </Badge>
                    <span className="font-[family-name:var(--font-mono)] text-sm">
                      {discrepancy.epc}
                    </span>
                  </div>
                  <ResolveDiscrepancyForm discrepancyId={discrepancy.id} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stated on the page, not only in a design document: the reason there
          is no "apply sweep to stock" button is that a reader misses tags. */}
      <p className="text-sm text-[var(--color-stone-500)]">
        A sweep is evidence, not a decision. Only a counted adjustment with a
        reason moves a stock figure, and anything valuable needs two people.
      </p>

      {activeLocationId ? null : (
        <p className="text-sm text-[var(--color-stone-500)]">
          Add a stock location before recording a sweep.
        </p>
      )}
    </div>
  );
}
