import {
  OrderRepository,
  ProductionPieceRepository,
  RetailerStaffRepository,
} from "@paon/database";
import { PIECE_KINDS } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";

import {
  addPiece,
  createSpec,
  issueWorkTicket,
  raiseDelayServiceRecovery,
} from "./actions";
import { AmendSpecForm, TransitionStageForm } from "./production-forms";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ProductionPage({
  searchParams,
}: {
  readonly searchParams?: Promise<{ readonly barcode?: string }>;
}) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const repo = new ProductionPieceRepository(supabase);
  const resolvedParams = (await searchParams) ?? {};

  const [specs, orders, staff, tickets, delayed] = await Promise.all([
    repo.findSpecsByRetailer({ retailerId: session.retailerId }),
    new OrderRepository(supabase).findByRetailer(session.retailerId),
    new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
    repo.findWorkTicketsByRetailer({ retailerId: session.retailerId }),
    repo.listDelayedPieces({
      retailerId: session.retailerId,
      asOf: new Date().toISOString().slice(0, 10),
    }),
  ]);

  const orderNumberById = new Map(
    orders.map((o) => [o.id as string, o.orderNumber]),
  );
  const staffOptions = staff.map((m) => ({
    id: m.id as string,
    fullName: m.fullName,
  }));

  const piecesBySpec = new Map(
    await Promise.all(
      specs.map(
        async (spec) =>
          [spec.id, await repo.findPiecesBySpec(spec.id)] as const,
      ),
    ),
  );

  const editableBySpecId = new Map<string, boolean>();
  for (const [specId, pieces] of piecesBySpec) {
    for (const piece of pieces) {
      const editable = await repo.checkSpecEditable(piece.id);
      if (!editableBySpecId.has(specId) || !editable.ok) {
        editableBySpecId.set(
          specId,
          editable.ok && !editable.requiresAmendment,
        );
      }
    }
  }

  const barcodeQuery = resolvedParams.barcode?.trim();
  const foundByBarcode = barcodeQuery
    ? await repo.findPieceByBarcode({
        retailerId: session.retailerId,
        barcode: barcodeQuery,
      })
    : null;

  const ticketViews = await Promise.all(
    tickets.map(async (ticket) => ({
      ticket,
      view: await repo.getOutworkerTicketView(ticket.id),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Production
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Serialized pieces, independent stages, and a spec that can&apos;t be
          silently rewritten after cutting starts.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Look up a piece by barcode
        </h2>
        <form action="/production" method="get" className="mt-3 flex gap-2">
          <Input
            name="barcode"
            type="text"
            placeholder="Scan or type a barcode"
            defaultValue={barcodeQuery}
            aria-label="Barcode"
          />
          <Button type="submit" variant="outline">
            Find
          </Button>
        </form>
        {barcodeQuery ? (
          <p className="mt-3 text-sm" data-barcode-result={barcodeQuery}>
            {foundByBarcode ? (
              <>
                <span className="font-medium text-[var(--color-stone-900)]">
                  {foundByBarcode.barcode}
                </span>{" "}
                — {foundByBarcode.piece_kind}, stage:{" "}
                {foundByBarcode.stage.replace(/_/g, " ")}
              </>
            ) : (
              "No piece with that barcode."
            )}
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Start a production spec
        </h2>
        <form action={createSpec} className="mt-3 flex flex-col gap-4">
          <FormField label="Order" htmlFor="orderId">
            <Select id="orderId" name="orderId" required>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber}
                </option>
              ))}
            </Select>
          </FormField>
          <div>
            <Button type="submit">Create spec</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Add a piece
        </h2>
        <form action={addPiece} className="mt-3 flex flex-col gap-4">
          <FormField label="Spec" htmlFor="specId">
            <Select id="specId" name="specId" required>
              {specs.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {orderNumberById.get(spec.order_id) ?? spec.order_id} (v
                  {spec.version})
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Piece" htmlFor="pieceKind">
            <Select id="pieceKind" name="pieceKind" required>
              {PIECE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Sequence" htmlFor="pieceSequence">
            <Input
              id="pieceSequence"
              name="pieceSequence"
              type="number"
              min={1}
              defaultValue={1}
              required
            />
          </FormField>
          <FormField label="Promised on (optional)" htmlFor="promisedOn">
            <Input id="promisedOn" name="promisedOn" type="date" />
          </FormField>
          <div>
            <Button type="submit">Add piece</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Pieces
        </h2>
        {specs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            No specs yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-6">
            {specs.map((spec) => {
              const pieces = piecesBySpec.get(spec.id) ?? [];
              const editable = editableBySpecId.get(spec.id) ?? true;
              return (
                <li
                  key={spec.id}
                  className="border-b border-[var(--color-stone-100)] pb-4 last:border-0"
                >
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    Order {orderNumberById.get(spec.order_id) ?? spec.order_id}
                  </p>
                  <ul className="mt-2 flex flex-col gap-3">
                    {pieces.map((piece) => (
                      <li
                        key={piece.id}
                        data-piece-id={piece.id}
                        data-piece-stage={piece.stage}
                        className="rounded border border-[var(--color-stone-100)] p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-[var(--color-stone-900)]">
                            {piece.barcode} — {piece.piece_kind}
                          </p>
                          <Badge
                            tone={
                              piece.stage === "ready" ||
                              piece.stage === "dispatched"
                                ? "success"
                                : piece.stage === "rework"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {piece.stage.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <TransitionStageForm
                          pieceId={piece.id}
                          stage={piece.stage}
                          staff={staffOptions}
                        />
                        <p className="mt-2 text-xs text-[var(--color-stone-500)]">
                          Spec: {editable ? "editable" : "requires amendment"}
                        </p>
                        {!editable ? (
                          <AmendSpecForm specId={spec.id} pieceId={piece.id} />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Outworker tickets
        </h2>
        <form action={issueWorkTicket} className="mt-3 flex flex-col gap-4">
          <FormField label="Piece" htmlFor="ticketPieceId">
            <Select id="ticketPieceId" name="pieceId" required>
              {[...piecesBySpec.values()].flat().map((piece) => (
                <option key={piece.id} value={piece.id}>
                  {piece.barcode}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Instructions" htmlFor="instructions">
            <Input id="instructions" name="instructions" type="text" required />
          </FormField>
          <FormField label="Due on" htmlFor="dueOn">
            <Input id="dueOn" name="dueOn" type="date" required />
          </FormField>
          <FormField
            label="Outworker reference (optional)"
            htmlFor="outworkerReference"
          >
            <Input
              id="outworkerReference"
              name="outworkerReference"
              type="text"
            />
          </FormField>
          <div>
            <Button type="submit">Issue ticket</Button>
          </div>
        </form>
        <ul className="mt-4 flex flex-col gap-3 border-t border-[var(--color-stone-100)] pt-4">
          {ticketViews.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              No tickets issued yet.
            </p>
          ) : (
            ticketViews.map(({ ticket, view }) =>
              view ? (
                <li
                  key={ticket.id}
                  data-ticket-id={ticket.id}
                  className="text-sm text-[var(--color-stone-700)]"
                >
                  <span className="font-medium text-[var(--color-stone-900)]">
                    {view.barcode}
                  </span>{" "}
                  — for {view.customerInitials}, due {view.dueOn}:{" "}
                  {view.instructions}
                </li>
              ) : null,
            )
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[var(--color-stone-900)]">
          Delayed pieces ({delayed.length})
        </h2>
        {delayed.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone-500)]">
            Nothing running late.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {delayed.map(({ piece, daysLate, requiresServiceRecovery }) => (
              <li
                key={piece.id}
                data-delayed-piece-id={piece.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-stone-100)] pb-3 last:border-0"
              >
                <p className="text-sm text-[var(--color-stone-700)]">
                  {piece.barcode} — {daysLate} day(s) late
                  {requiresServiceRecovery ? (
                    <Badge tone="danger" className="ml-2">
                      Needs service recovery
                    </Badge>
                  ) : null}
                </p>
                {requiresServiceRecovery ? (
                  <form action={raiseDelayServiceRecovery}>
                    <input type="hidden" name="pieceId" value={piece.id} />
                    <input type="hidden" name="daysLate" value={daysLate} />
                    <Button type="submit" size="sm" variant="outline">
                      Raise service recovery
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
