import { StockLedgerRepository } from "@paon/database";
import { retailerRoleAtLeast, type LedgerEntryKind } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";

import {
  AdjustForm,
  CloseCountForm,
  HoldForm,
  OpenCountForm,
  RecordCountForm,
  ReceiveForm,
  ReverseForm,
  TransferForm,
  type Option,
} from "./inventory-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Plain language for every ledger kind. UX_PHILOSOPHY rule 1: status is
 * legible without a click and never an internal enum the reader has to
 * interpret. `transfer_out` is not a word anyone says on a shop floor.
 */
const MOVEMENT_LABEL: Record<LedgerEntryKind, string> = {
  receipt: "Received",
  sale: "Sold",
  reservation: "Held for a client",
  reservation_release: "Hold released",
  transfer_out: "Sent out",
  transfer_in: "Arrived",
  count_adjustment: "Adjusted after a count",
  reversal: "Undone",
};

const MOVEMENT_TONE: Partial<
  Record<LedgerEntryKind, "success" | "warning" | "neutral">
> = {
  receipt: "success",
  transfer_in: "success",
  sale: "neutral",
  transfer_out: "neutral",
  reservation: "warning",
  count_adjustment: "warning",
  reversal: "neutral",
};

/**
 * Stock (PHASE 13.1 / INV-101, INV-102).
 *
 * There is no stock level stored anywhere. Every number on this page is a
 * projection over an append-only ledger, which is why nothing here can
 * silently edit a balance — the only way to change one is to append a
 * movement, and the only movement that needs a human explanation (an
 * adjustment after a count) refuses to save without one.
 */
export default async function InventoryPage({
  searchParams,
}: {
  readonly searchParams?: Promise<{ readonly location?: string }>;
}) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const repo = new StockLedgerRepository(supabase);
  const resolved = (await searchParams) ?? {};

  const locations = await repo.listLocations({
    retailerId: session.retailerId,
  });
  const activeLocationId = resolved.location ?? locations[0]?.id;
  const isManager = retailerRoleAtLeast(session.retailerRole, "manager");

  // `inventory_quantity` is the number the storefront, tie-mate, low-stock
  // export and morning routine all read. It is no longer a second truth:
  // since migrations 18-21 it is a maintained PROJECTION of this same ledger
  // (available across every location, clamped at zero), and the only way to
  // change it is to append a movement. A direct write to it is converted into
  // the ledger entry it should have been, so the two cannot drift —
  // `count_inventory_disagreements()` exists to prove that and must stay at 0.
  //
  // It is shown alongside the per-location figures below because they answer
  // different questions: this page is "what is in THIS room", the catalogue
  // number is "what can still be promised anywhere".
  const { data: variantRows } = await supabase
    .from("product_variants")
    .select("id, sku, size, inventory_quantity")
    .limit(50);

  const items: Option[] = (variantRows ?? []).map((variant) => ({
    id: variant.id,
    label: variant.size ? `${variant.sku} · ${variant.size}` : variant.sku,
  }));
  const legacyQuantityByVariant = new Map(
    (variantRows ?? []).map((v) => [v.id, v.inventory_quantity]),
  );
  const labelByVariant = new Map(items.map((item) => [item.id, item.label]));
  const locationOptions: Option[] = locations.map((location) => ({
    id: location.id,
    label: location.name,
  }));

  if (!activeLocationId) {
    // Designed empty state, per UX_PHILOSOPHY rule 5 — a real sentence with
    // the next action in it, not a blank table.
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            Stock
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            Every figure here is counted from movements, never stored.
          </p>
        </div>
        <Card>
          <p
            id="inventory-no-locations"
            className="text-sm text-[var(--color-stone-600)]"
          >
            No stock locations yet. A location is a place you keep garments —
            the shop floor, the stockroom, a second shop. Add one and stock
            movements can start being recorded against it.
          </p>
        </Card>
      </div>
    );
  }

  const [balances, countSession] = await Promise.all([
    repo.balancesAtLocation({
      retailerId: session.retailerId,
      locationId: activeLocationId,
    }),
    repo.findOpenCountSession({
      retailerId: session.retailerId,
      locationId: activeLocationId,
    }),
  ]);

  const reconciliation = countSession
    ? await repo.reconcileCount({
        retailerId: session.retailerId,
        sessionId: countSession.id,
        locationId: activeLocationId,
      })
    : null;

  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const recentByVariant = await Promise.all(
    balances.slice(0, 6).map(async (balance) => ({
      balance,
      entries: (
        await repo.entriesFor({
          retailerId: session.retailerId,
          variantId: balance.variantId,
          locationId: activeLocationId,
        })
      )
        .slice(-3)
        .reverse(),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Stock
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Every figure here is counted from movements, never stored. Nothing on
          this page can quietly change a number.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Locations
        </h2>
        <ul id="inventory-locations" className="mt-3 flex flex-wrap gap-2">
          {locations.map((location) => (
            <li key={location.id}>
              <a
                href={`/inventory?location=${location.id}`}
                data-location-id={location.id}
                aria-current={
                  location.id === activeLocationId ? "page" : undefined
                }
                className={
                  location.id === activeLocationId
                    ? "inline-flex rounded-[var(--radius-md)] border border-[var(--color-stone-900)] px-3 py-1.5 text-sm text-[var(--color-stone-900)]"
                    : "inline-flex rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-1.5 text-sm text-[var(--color-stone-600)] transition-colors duration-150 ease-[var(--ease-out-quiet)] hover:border-[var(--color-stone-400)]"
                }
              >
                {location.name}
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          On hand at {activeLocation?.name ?? "this location"}
        </h2>
        {balances.length === 0 ? (
          <p
            id="inventory-no-stock"
            className="mt-3 text-sm text-[var(--color-stone-600)]"
          >
            Nothing has moved here yet. Receive something below and it will
            appear, with every movement that produced the figure.
          </p>
        ) : (
          <ul
            id="inventory-balances"
            data-balance-count={balances.length}
            className="mt-3 flex flex-col gap-4"
          >
            {recentByVariant.map(({ balance, entries }) => (
              <li
                key={balance.variantId}
                data-variant-id={balance.variantId}
                data-on-hand={balance.onHand}
                data-reserved={balance.reserved}
                data-available={balance.available}
                className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="font-mono text-sm text-[var(--color-stone-900)]">
                    {labelByVariant.get(balance.variantId) ?? balance.variantId}
                  </p>
                  <p className="text-sm text-[var(--color-stone-700)]">
                    {balance.available} available
                  </p>
                  {balance.reserved > 0 ? (
                    <p className="text-sm text-[var(--color-stone-500)]">
                      {balance.onHand} on the shelf, {balance.reserved} promised
                    </p>
                  ) : null}
                  {balance.available < 0 ? (
                    // Surfaced rather than clamped: a negative availability
                    // means something oversold and someone must know.
                    <Badge tone="danger">oversold</Badge>
                  ) : null}
                </div>
                {(() => {
                  const catalogue = legacyQuantityByVariant.get(
                    balance.variantId,
                  );
                  if (catalogue === undefined) return null;
                  return (
                    <p
                      data-catalogue-quantity={catalogue}
                      className="mt-1 text-sm text-[var(--color-stone-500)]"
                    >
                      {catalogue} available to sell online, counting every
                      location and every hold.
                    </p>
                  );
                })()}
                <ul className="mt-2 flex flex-col gap-1">
                  {entries.map((entry) => (
                    <li
                      key={entry.entryId}
                      className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-stone-500)]"
                    >
                      <Badge tone={MOVEMENT_TONE[entry.kind] ?? "neutral"}>
                        {MOVEMENT_LABEL[entry.kind]}
                      </Badge>
                      <span>
                        {entry.quantity > 0 ? entry.quantity : entry.quantity}
                      </span>
                      <span>{entry.occurredAt.slice(0, 10)}</span>
                      {entry.kind !== "reversal" ? (
                        <ReverseForm entryId={entry.entryId} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Record a movement
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone-600)]">
          Holding stock does not take it off the shelf — it promises it to
          someone, so the shelf figure and the sellable figure stay separate.
        </p>
        <ReceiveForm items={items} locations={locationOptions} />
        <HoldForm items={items} locations={locationOptions} />
        <TransferForm items={items} locations={locationOptions} />
      </Card>

      {isManager ? (
        <Card>
          <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
            Stock count
          </h2>
          {countSession ? (
            <>
              <p
                id="inventory-count-open"
                data-session-id={countSession.id}
                className="mt-1 text-sm text-[var(--color-stone-600)]"
              >
                A blind count is open. Record what you physically see; the
                expected figure is deliberately not shown while you count.
              </p>
              <RecordCountForm sessionId={countSession.id} items={items} />

              {reconciliation && reconciliation.variances.length > 0 ? (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                    Differences found
                  </h3>
                  {reconciliation.recountRequired ? (
                    <p
                      id="inventory-recount-required"
                      className="mt-1 text-sm text-[var(--color-stone-700)]"
                    >
                      One of these is large enough to be worth counting again
                      before anything is written off.
                    </p>
                  ) : null}
                  <ul
                    id="inventory-variances"
                    className="mt-3 flex flex-col gap-4"
                  >
                    {reconciliation.variances.map((variance) => (
                      <li
                        key={variance.variantId}
                        data-variance-variant={variance.variantId}
                        data-variance-quantity={variance.varianceQuantity}
                        data-requires-recount={String(variance.requiresRecount)}
                        className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
                      >
                        <p className="font-mono text-sm text-[var(--color-stone-900)]">
                          {labelByVariant.get(variance.variantId) ??
                            variance.variantId}
                        </p>
                        <p className="mt-1 text-sm text-[var(--color-stone-700)]">
                          Counted {variance.countedQuantity}, expected{" "}
                          {variance.expectedQuantity} —{" "}
                          {variance.varianceQuantity > 0
                            ? `${variance.varianceQuantity} more than the ledger`
                            : `${Math.abs(variance.varianceQuantity)} fewer than the ledger`}
                          .
                        </p>
                        {variance.requiresRecount ? (
                          <Badge tone="warning">count again first</Badge>
                        ) : (
                          <AdjustForm
                            sessionId={countSession.id}
                            locationId={activeLocationId}
                            variantId={variance.variantId}
                            suggestedQuantity={variance.varianceQuantity}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : reconciliation ? (
                <p
                  id="inventory-count-matches"
                  className="mt-4 text-sm text-[var(--color-stone-600)]"
                >
                  Everything counted so far matches the ledger.
                </p>
              ) : null}

              {reconciliation &&
              reconciliation.uncountedVariantIds.length > 0 ? (
                <p
                  id="inventory-uncounted"
                  className="mt-3 text-sm text-[var(--color-stone-500)]"
                >
                  Still to count:{" "}
                  {reconciliation.uncountedVariantIds
                    .map((id) => labelByVariant.get(id) ?? id)
                    .join(", ")}
                  . Not counted is not the same as none there, so nothing is
                  assumed about these.
                </p>
              ) : null}

              <CloseCountForm sessionId={countSession.id} />
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-[var(--color-stone-600)]">
                No count open here. A count never changes a figure by itself —
                it produces differences a manager then explains one at a time.
              </p>
              <OpenCountForm locations={locationOptions} />
            </>
          )}
        </Card>
      ) : null}
    </div>
  );
}
