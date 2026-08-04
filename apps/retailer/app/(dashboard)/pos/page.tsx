import {
  PosRepository,
  ProductVariantRepository,
  StockLedgerRepository,
} from "@paon/database";
import { CASH_TENDER, type CartLineKind } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";

import {
  AddLineForm,
  CancelSaleForm,
  CardPaymentForm,
  OpenSaleForm,
  ResumeSaleForm,
  ReturnLineForm,
  SuspendSaleForm,
  TakeCashForm,
  type Option,
} from "./pos-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Plain language for every line kind. UX_PHILOSOPHY rule 1: a status is
 * legible without a click and is never an internal enum. Nobody at a counter
 * says "alteration_service".
 */
const KIND_LABEL: Record<CartLineKind, string> = {
  rtw: "From stock",
  alteration_service: "Alteration work",
  mtm: "Made to measure",
};

/**
 * What each kind means for a return, stated on the sale itself rather than
 * discovered when a client is already asking. The rule lives in the domain;
 * this is only its sentence.
 */
const KIND_RETURN_NOTE: Record<CartLineKind, string> = {
  rtw: "Returnable within the window, and comes back to the shelf.",
  alteration_service: "Refundable only if the work has not been done yet.",
  mtm: "Cut for one person, so it cannot be returned.",
};

function euros(minorUnits: number): string {
  return `€${(minorUnits / 100).toFixed(2)}`;
}

/**
 * Point of sale (PHASE 13.3 / POS-101).
 *
 * The till keeps no idea of stock of its own. A garment in a sale is HELD in
 * the 13.1 ledger, so it is genuinely off the shelf while the client decides;
 * it is SOLD when the money is recorded, not when the line is added; and a
 * return writes a new linked sale that puts it back. That is why a finished
 * sale on this page has no edit button anywhere — the correction for a
 * completed sale is a return, which keeps both facts true afterwards.
 */
export default async function PosPage({
  searchParams,
}: {
  readonly searchParams?: Promise<{ readonly location?: string }>;
}) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const pos = new PosRepository(supabase);
  const ledger = new StockLedgerRepository(supabase);
  const resolved = (await searchParams) ?? {};

  const locations = await ledger.listLocations({
    retailerId: session.retailerId,
  });
  const activeLocationId = resolved.location ?? locations[0]?.id;

  const locationOptions: Option[] = locations.map((location) => ({
    id: location.id,
    label: location.name,
  }));

  if (!activeLocationId) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-[family-name:var(--font-display)] text-3xl">
            The till.
          </h1>
          <p className="text-[var(--color-stone-600)]">
            Selling starts with somewhere to sell from.
          </p>
        </header>
        <Card id="pos-no-location" className="p-6">
          <p className="text-sm text-[var(--color-stone-600)]">
            No stock locations yet. Add one on the Stock page and this till will
            open here.
          </p>
        </Card>
      </div>
    );
  }

  const variantRows = await new ProductVariantRepository(
    supabase,
  ).findForRetailer(session.retailerId);
  const items: Option[] = variantRows.map((variant) => ({
    id: variant.id,
    label: variant.size ? `${variant.sku} · ${variant.size}` : variant.sku,
  }));
  const labelByVariant = new Map(items.map((item) => [item.id, item.label]));

  const open = await pos.findOpenTransaction({
    retailerId: session.retailerId,
    locationId: activeLocationId,
  });
  const openSale = open
    ? await pos.load({
        retailerId: session.retailerId,
        transactionId: open.id,
      })
    : null;
  const capturedSoFar = open
    ? await pos.capturedMinorUnits({
        retailerId: session.retailerId,
        transactionId: open.id,
      })
    : 0;

  const recent = await pos.listCompleted({
    retailerId: session.retailerId,
    locationId: activeLocationId,
    limit: 5,
  });

  const suspended = await pos.listSuspended({
    retailerId: session.retailerId,
    locationId: activeLocationId,
  });
  const suspendedWithTotals = await Promise.all(
    suspended.map(async (transaction) => {
      const loaded = await pos.load({
        retailerId: session.retailerId,
        transactionId: transaction.id,
      });
      return { transaction, totals: loaded?.totals ?? null };
    }),
  );

  const outstanding = openSale
    ? openSale.totals.subtotalMinorUnits - capturedSoFar
    : 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          The till.
        </h1>
        <p className="text-[var(--color-stone-600)]">
          A garment leaves the shelf when the money arrives, and never before.
        </p>
      </header>

      {/* Which till, when a shop has more than one counter. */}
      {locations.length > 1 ? (
        <nav aria-label="Tills" className="flex flex-wrap gap-2">
          {locations.map((location) => (
            <a
              key={location.id}
              href={`/pos?location=${location.id}`}
              data-till-link={location.id}
              className={
                location.id === activeLocationId
                  ? "rounded-[var(--radius-sm)] bg-[var(--color-stone-900)] px-3 py-1.5 text-sm text-[#f0efec]"
                  : "rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-1.5 text-sm text-[var(--color-stone-700)] transition-colors duration-150 ease-[var(--ease-out-quiet)] hover:bg-[var(--color-stone-50)]"
              }
            >
              {location.name}
            </a>
          ))}
        </nav>
      ) : null}

      {openSale === null ? (
        <Card className="flex flex-col gap-4 p-6" id="pos-no-sale">
          <div className="flex flex-col gap-1">
            <h2 className="font-[family-name:var(--font-display)] text-xl">
              Nothing on the counter.
            </h2>
            <p className="text-sm text-[var(--color-stone-600)]">
              Start a sale when someone is ready. Anything you add is held for
              them until it is paid for or the sale is cancelled.
            </p>
          </div>
          <div className="max-w-sm">
            <OpenSaleForm locations={locationOptions} />
          </div>
        </Card>
      ) : (
        <section
          className="flex flex-col gap-6"
          data-sale-id={openSale.transaction.id}
          data-sale-state={openSale.transaction.state}
          data-sale-total={openSale.totals.subtotalMinorUnits}
          data-sale-captured={capturedSoFar}
          data-sale-line-count={openSale.totals.lineCount}
        >
          <Card className="flex flex-col gap-5 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-xl">
                On the counter
              </h2>
              <p className="font-[family-name:var(--font-mono)] text-2xl tabular-nums">
                {euros(openSale.totals.subtotalMinorUnits)}
              </p>
            </div>

            {openSale.lines.length === 0 ? (
              <p className="text-sm text-[var(--color-stone-600)]">
                Empty so far. Nothing is held and nothing is owed.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--color-stone-100)]">
                {openSale.lines.map((line) => (
                  <li
                    key={line.lineId}
                    data-line-id={line.lineId}
                    data-line-kind={line.kind}
                    data-line-quantity={line.quantity}
                    className="flex flex-wrap items-start justify-between gap-3 py-3"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-[var(--color-stone-900)]">
                        {line.variantId
                          ? (labelByVariant.get(line.variantId) ?? "Item")
                          : KIND_LABEL[line.kind]}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-stone-500)]">
                        <Badge
                          tone={line.kind === "rtw" ? "warning" : "neutral"}
                        >
                          {KIND_LABEL[line.kind]}
                        </Badge>
                        {/* The held-vs-sold distinction, said out loud. */}
                        {line.reservesStock ? (
                          <span data-line-held="true">
                            Held for this client — still on the books, not yet
                            sold
                          </span>
                        ) : (
                          <span>Not stock, so nothing is held</span>
                        )}
                      </span>
                    </div>
                    <p className="font-[family-name:var(--font-mono)] text-sm tabular-nums">
                      {line.quantity} × {euros(line.unitPriceMinorUnits)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {/* Kinds stay apart, because a refund decision needs them apart. */}
            {openSale.totals.lineCount > 0 ? (
              <dl className="grid gap-2 border-t border-[var(--color-stone-100)] pt-4 sm:grid-cols-3">
                {(
                  Object.entries(
                    openSale.totals.byKindMinorUnits,
                  ) as ReadonlyArray<readonly [CartLineKind, number]>
                )
                  .filter(([, amount]) => amount > 0)
                  .map(([kind, amount]) => (
                    <div key={kind} className="flex flex-col gap-0.5">
                      <dt className="text-xs text-[var(--color-stone-500)]">
                        {KIND_LABEL[kind]}
                      </dt>
                      <dd
                        data-kind-total={kind}
                        className="font-[family-name:var(--font-mono)] text-sm tabular-nums"
                      >
                        {euros(amount)}
                      </dd>
                      <dd className="text-xs text-[var(--color-stone-500)]">
                        {KIND_RETURN_NOTE[kind]}
                      </dd>
                    </div>
                  ))}
              </dl>
            ) : null}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="flex flex-col gap-4 p-6">
              <h2 className="font-[family-name:var(--font-display)] text-lg">
                Add to the sale
              </h2>
              <AddLineForm
                transactionId={openSale.transaction.id}
                locationId={activeLocationId}
                items={items}
              />
            </Card>

            <Card className="flex flex-col gap-5 p-6">
              <div className="flex flex-col gap-1">
                <h2 className="font-[family-name:var(--font-display)] text-lg">
                  Take payment
                </h2>
                <p
                  data-sale-outstanding={outstanding}
                  className="text-sm text-[var(--color-stone-600)]"
                >
                  {outstanding > 0
                    ? `${euros(outstanding)} still to pay.`
                    : "Fully paid."}
                </p>
              </div>

              {openSale.totals.lineCount === 0 ? (
                <p className="text-sm text-[var(--color-stone-600)]">
                  Add something first.
                </p>
              ) : (
                <>
                  <TakeCashForm
                    transactionId={openSale.transaction.id}
                    locationId={activeLocationId}
                    totalLabel={euros(outstanding > 0 ? outstanding : 0)}
                  />
                  <div className="flex flex-col gap-3 border-t border-[var(--color-stone-100)] pt-4">
                    {/* Not hidden. A missing button is a mystery; a refusal
                        that explains itself is an answer. */}
                    <p className="text-xs text-[var(--color-stone-500)]">
                      Card is not switched on yet, so the till takes{" "}
                      {CASH_TENDER} today. Recording a terminal payment will be
                      refused until card is approved — the form is here so you
                      can see that rather than wonder.
                    </p>
                    <CardPaymentForm transactionId={openSale.transaction.id} />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-3 border-t border-[var(--color-stone-100)] pt-4">
                <SuspendSaleForm transactionId={openSale.transaction.id} />
                <CancelSaleForm
                  transactionId={openSale.transaction.id}
                  locationId={activeLocationId}
                />
              </div>
            </Card>
          </div>
        </section>
      )}

      {suspendedWithTotals.length > 0 ? (
        <section className="flex flex-col gap-4" data-suspended-sales>
          <div className="flex flex-col gap-1">
            <h2 className="font-[family-name:var(--font-display)] text-xl">
              Parked for later
            </h2>
            <p className="text-sm text-[var(--color-stone-600)]">
              Suspended while another client was served. Everything held is
              still off the shelf, exactly as it was.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {suspendedWithTotals.map(({ transaction, totals }) => (
              <li key={transaction.id}>
                <Card
                  className="flex flex-wrap items-center justify-between gap-3 p-5"
                  data-suspended-sale={transaction.id}
                  data-suspended-total={totals?.subtotalMinorUnits ?? 0}
                >
                  <div className="flex flex-col gap-1">
                    <p className="font-[family-name:var(--font-mono)] text-lg tabular-nums">
                      {euros(totals?.subtotalMinorUnits ?? 0)}
                    </p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {totals?.lineCount ?? 0} item
                      {(totals?.lineCount ?? 0) === 1 ? "" : "s"} held
                    </p>
                  </div>
                  <ResumeSaleForm
                    transactionId={transaction.id}
                    locationId={activeLocationId}
                  />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Finished today
          </h2>
          <p className="text-sm text-[var(--color-stone-600)]">
            A finished sale cannot be edited. To correct one, return the item —
            that keeps the sale and the refund both true.
          </p>
        </div>

        {recent.length === 0 ? (
          <Card id="pos-no-sales" className="p-6">
            <p className="text-sm text-[var(--color-stone-600)]">
              Nothing sold at this till yet.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {recent.map((transaction) => (
              <li key={transaction.id}>
                <CompletedSale
                  transactionId={transaction.id}
                  locationId={activeLocationId}
                  isReturn={transaction.returns_transaction_id !== null}
                  labelByVariant={labelByVariant}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** One finished sale, with a return offered per line rather than per sale. */
async function CompletedSale({
  transactionId,
  locationId,
  isReturn,
  labelByVariant,
}: {
  readonly transactionId: string;
  readonly locationId: string;
  readonly isReturn: boolean;
  readonly labelByVariant: ReadonlyMap<string, string>;
}) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const loaded = await new PosRepository(supabase).load({
    retailerId: session.retailerId,
    transactionId,
  });
  if (!loaded) return null;

  return (
    <Card
      className="flex flex-col gap-4 p-5"
      data-completed-sale={transactionId}
      data-completed-total={loaded.totals.subtotalMinorUnits}
      data-completed-is-return={isReturn ? "true" : "false"}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={isReturn ? "warning" : "success"}>
            {isReturn ? "Refund" : "Sold"}
          </Badge>
          <span className="text-xs text-[var(--color-stone-500)]">
            {isReturn
              ? "A return, linked to the original sale"
              : "Paid and finished"}
          </span>
        </div>
        <p className="font-[family-name:var(--font-mono)] text-sm tabular-nums">
          {euros(loaded.totals.subtotalMinorUnits)}
        </p>
      </div>

      {loaded.lines.length > 0 ? (
        <ul className="flex flex-col divide-y divide-[var(--color-stone-100)]">
          {loaded.lines.map((line) => (
            <li
              key={line.lineId}
              data-sold-line={line.lineId}
              data-sold-kind={line.kind}
              className="flex flex-wrap items-center justify-between gap-3 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">
                  {line.variantId
                    ? (labelByVariant.get(line.variantId) ?? "Item")
                    : KIND_LABEL[line.kind]}
                </span>
                <span className="text-xs text-[var(--color-stone-500)]">
                  {line.quantity} × {euros(line.unitPriceMinorUnits)} ·{" "}
                  {KIND_RETURN_NOTE[line.kind]}
                </span>
              </div>
              {/* Offered on every line. The rules refuse the ones that
                  cannot come back, and say why. */}
              <ReturnLineForm
                transactionId={transactionId}
                locationId={locationId}
                lineId={line.lineId}
                kind={line.kind}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
