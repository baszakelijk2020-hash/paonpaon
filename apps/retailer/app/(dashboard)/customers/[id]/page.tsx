import {
  AIGenerationRepository,
  AlterationRepository,
  AnalyticsRepository,
  AppointmentRepository,
  ClientelingRepository,
  CustomerRepository,
  LoyaltyRepository,
  OrderRepository,
  PhysicalGarmentRepository,
} from "@paon/database";
import { asId, retailerRoleAtLeast } from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate, formatMoney } from "@paon/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AlterationStatusBadge } from "../../alterations/status-badge";
import { startConversation } from "../../messages/actions";
import { LifecycleBadge, LIFECYCLE_STAGE_LABEL } from "../lifecycle-badge";

import { createClientelingNote, setPreferredCarrier } from "./actions";
import { AIInsights } from "./ai-insights";
import { SelfPortrait } from "./self-portrait";

import { getAIProvider } from "@/lib/ai";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const CARRIER_LABELS: [string, string][] = [
  ["dhl", "DHL"],
  ["postnl", "PostNL"],
  ["ups", "UPS"],
  ["fedex", "FedEx"],
  ["local_courier", "Local courier"],
  ["customer_pickup", "Customer pickup"],
];

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const customer = await new CustomerRepository(supabase).findById(
    asId<"CustomerId">(id),
  );

  if (!customer) {
    notFound();
  }

  const [
    garments,
    notes,
    orders,
    appointments,
    aiHistory,
    loyaltyAccount,
    recentEvents,
    alterations,
  ] = await Promise.all([
    new PhysicalGarmentRepository(supabase).findByCustomer(customer.id),
    new ClientelingRepository(supabase).findByCustomer(customer.id),
    new OrderRepository(supabase).findByCustomer(customer.id),
    new AppointmentRepository(supabase).findByCustomer(customer.id),
    new AIGenerationRepository(supabase).findByCustomer(customer.id, 5),
    new LoyaltyRepository(supabase).findAccountByCustomer(customer.id),
    new AnalyticsRepository(supabase).findRecentByCustomer(
      session.retailerId,
      customer.id,
    ),
    new AlterationRepository(supabase).findByCustomer(customer.id),
  ]);
  const garmentById = new Map(garments.map((garment) => [garment.id, garment]));

  /** Fit-tool values (Neiging, Kraag, Schouder R/L, etc.) are captured
   * per garment during intake/alteration, not as customer-level
   * constants — see the empty-state copy below. Surfacing them here,
   * against the exact garment (and its `categoryCode`, e.g. jacket vs
   * suit) they were recorded for, is what actually "links the values to
   * the customer card" without conflating a fitting note from one
   * jacket with a different garment's fit. */
  const garmentObservations = await Promise.all(
    garments.map((garment) =>
      new PhysicalGarmentRepository(supabase).findObservationsByGarment(
        garment.id,
      ),
    ),
  );
  const observationsByGarmentId = new Map(
    garments.map((garment, index) => [
      garment.id,
      garmentObservations[index] ?? [],
    ]),
  );
  const canManage = retailerRoleAtLeast(
    session.retailerRole,
    "sales_associate",
  );
  const pinnedNote = notes.find((note) => note.pinned) ?? null;
  const now = Date.now();
  const nextAppointment = appointments
    .filter(
      (appointment) =>
        new Date(appointment.startsAt).getTime() >= now &&
        !["completed", "canceled", "no_show"].includes(appointment.status),
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )[0];
  const lastOrder = orders[0];
  const lifetimeValue = orders.reduce(
    (total, order) => total + order.total.amountMinorUnits,
    0,
  );
  const lifetimeMoney = lastOrder
    ? { amountMinorUnits: lifetimeValue, currency: lastOrder.total.currency }
    : null;
  const initials = customer.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex flex-col gap-8">
      <section className="paon-reveal relative isolate overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-stone-900)] p-7 text-white shadow-[var(--shadow-elevated)] sm:p-10">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full border border-white/10 bg-white/5"
        />
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="flex items-start gap-5">
            <div className="font-display flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl sm:h-20 sm:w-20">
              {initials || "P"}
            </div>
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-white/60">
                  Relationship workspace
                </p>
                <LifecycleBadge stage={customer.lifecycleStage} />
              </div>
              <h1 className="font-display text-3xl leading-none sm:text-4xl">
                {customer.fullName}
              </h1>
              <p className="mt-4 text-sm text-white/65">
                {customer.email ?? "No email on file"}
                {customer.phone ? ` · ${customer.phone}` : ""}
              </p>
              {pinnedNote ? (
                <p className="mt-4 max-w-2xl border-l border-white/40 pl-4 text-sm leading-6 text-white/80">
                  “{pinnedNote.body}”
                </p>
              ) : null}
            </div>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-3">
              <form action={startConversation}>
                <input type="hidden" name="customerId" value={customer.id} />
                <button
                  type="submit"
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                  })}
                >
                  Message client
                </button>
              </form>
              <Link
                href={`/alterations/new?customerId=${customer.id}`}
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "border-white/30 text-white hover:bg-white/10",
                })}
              >
                Begin garment intake
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section
        className="paon-reveal grid grid-cols-2 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white shadow-[var(--shadow-lifted)] lg:grid-cols-4"
        style={{ animationDelay: "120ms" }}
      >
        <div className="border-b border-r border-[var(--color-stone-200)] p-5 sm:p-6">
          <p className="text-xs text-[var(--color-stone-500)]">Relationship</p>
          <p className="mt-2 text-lg">
            {LIFECYCLE_STAGE_LABEL[customer.lifecycleStage]}
          </p>
        </div>
        <div className="border-b border-r border-[var(--color-stone-200)] p-5 sm:p-6">
          <p className="text-xs text-[var(--color-stone-500)]">
            Lifetime orders
          </p>
          <p className="mt-2 text-lg">
            {orders.length}
            {lifetimeMoney ? ` · ${formatMoney(lifetimeMoney, "en-US")}` : ""}
          </p>
        </div>
        <div className="border-b border-r border-[var(--color-stone-200)] p-5 sm:p-6">
          <p className="text-xs text-[var(--color-stone-500)]">Wardrobe</p>
          <p className="mt-2 text-lg">
            {garments.length} garment{garments.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="border-b border-[var(--color-stone-200)] p-5 sm:p-6">
          <p className="text-xs text-[var(--color-stone-500)]">Portal</p>
          <div className="mt-2">
            <Badge tone={customer.userId ? "success" : "neutral"}>
              {customer.userId ? "Connected" : "Not connected"}
            </Badge>
          </div>
        </div>
      </section>

      {canManage ? (
        <Card
          className="paon-reveal rounded-[var(--radius-md)]"
          style={{ animationDelay: "180ms" }}
        >
          <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            Floor visit
          </p>
          <h2 className="font-display mt-2 text-2xl">With them right now?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
            Add lines from the storefront while with the client — full POS visit
            mode ships next.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/appointments/new?customerId=${customer.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              New appointment
            </Link>
            <form action={startConversation}>
              <input type="hidden" name="customerId" value={customer.id} />
              <button
                type="submit"
                className={buttonVariants({ variant: "outline" })}
              >
                Message
              </button>
            </form>
            <Link
              href="/products"
              className={buttonVariants({ variant: "ghost" })}
            >
              Browse catalogue
            </Link>
          </div>
          <form
            action={createClientelingNote}
            className="mt-5 flex flex-col gap-2 border-t border-[var(--color-stone-100)] pt-4 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="customerId" value={customer.id} />
            <div className="flex-1">
              <label
                htmlFor="interest-note"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]"
              >
                Log interest
              </label>
              <input
                id="interest-note"
                name="body"
                required
                maxLength={2000}
                placeholder="What did they try on or ask about?"
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm"
              />
            </div>
            <button
              type="submit"
              className={buttonVariants({ size: "sm", className: "shrink-0" })}
            >
              Log interest
            </button>
          </form>
        </Card>
      ) : null}

      <section
        className="paon-reveal grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"
        style={{ animationDelay: "240ms" }}
      >
        <Card className="rounded-[var(--radius-md)] border-l-4 border-l-[var(--color-stone-900)]">
          <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            Next best moment
          </p>
          {nextAppointment ? (
            <>
              <h2 className="font-display mt-3 text-3xl capitalize">
                Prepare the {nextAppointment.type.replaceAll("_", " ")}
              </h2>
              <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                {formatDate(nextAppointment.startsAt, "en-US")} ·{" "}
                {nextAppointment.status.replaceAll("_", " ")}
              </p>
              <Link
                href={`/appointments/${nextAppointment.id}`}
                className={buttonVariants({
                  variant: "outline",
                  className: "mt-5",
                })}
              >
                Open appointment brief
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-display mt-3 text-3xl">
                Create the next reason to return.
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-stone-500)]">
                There is no upcoming appointment. Use the relationship context
                below to make a relevant, personal follow-up.
              </p>
            </>
          )}
        </Card>
        <Card className="rounded-[var(--radius-md)]">
          <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            Relationship provenance
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[var(--color-stone-500)]">Introduced</dt>
              <dd className="mt-1">
                {formatDate(customer.createdAt, "en-US")}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-stone-500)]">Source</dt>
              <dd className="mt-1 capitalize">
                {customer.acquisitionSource?.replaceAll("_", " ") ??
                  "Personal introduction"}
              </dd>
            </div>
          </dl>
          {canManage ? (
            <Link
              href={`/wedding-parties/new?customerId=${customer.id}`}
              className="mt-5 inline-flex text-sm underline underline-offset-4"
            >
              Begin a wedding party relationship →
            </Link>
          ) : null}
        </Card>
      </section>

      {canManage ? (
        <Card>
          <p className="mb-1 text-sm font-medium text-[var(--color-stone-900)]">
            Shipping
          </p>
          {customer.shippingAddresses.length > 0 ? (
            <div className="mb-3 flex flex-col gap-1 text-sm text-[var(--color-stone-700)]">
              {customer.shippingAddresses.map((address, index) => (
                <p key={index}>
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}, {address.city}
                  {address.region ? `, ${address.region}` : ""}{" "}
                  {address.postalCode}, {address.countryCode}
                </p>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-sm text-[var(--color-stone-500)]">
              No address on file yet.
            </p>
          )}
          <p className="mb-2 text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Preferred carrier
          </p>
          <div className="flex flex-wrap gap-2">
            {CARRIER_LABELS.map(([value, label]) => (
              <form key={value} action={setPreferredCarrier}>
                <input type="hidden" name="customerId" value={customer.id} />
                <input type="hidden" name="carrier" value={value} />
                <button
                  type="submit"
                  aria-pressed={customer.preferredCarrier === value}
                  className={`rounded-[var(--radius-md)] border px-3 py-1 text-xs transition-[background-color,color] duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${
                    customer.preferredCarrier === value
                      ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-white"
                      : "border-[var(--color-stone-300)] text-[var(--color-stone-600)]"
                  }`}
                >
                  {label}
                </button>
              </form>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--color-stone-500)]">
            Records the arrangement for staff to act on — no live carrier
            integration is connected yet.
          </p>
        </Card>
      ) : null}

      {canManage ? (
        <SelfPortrait
          loyaltyAccount={loyaltyAccount}
          recentEvents={recentEvents}
          pinnedNote={pinnedNote}
        />
      ) : null}

      {canManage ? (
        <AIInsights
          customerId={customer.id}
          aiConfigured={!!getAIProvider()}
          history={aiHistory}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="clienteling-notes">
          <h2 className="mb-3 text-lg font-medium">House notes</h2>
          {canManage ? (
            <form
              action={createClientelingNote}
              className="mb-5 flex flex-col gap-3"
            >
              <input type="hidden" name="customerId" value={customer.id} />
              <textarea
                name="body"
                required
                maxLength={5000}
                className="min-h-24 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-sm"
                placeholder="Preferences, personal context, follow-up…"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="pinned" />
                Pin for the team
              </label>
              <button type="submit" className={buttonVariants({ size: "sm" })}>
                Add private note
              </button>
            </form>
          ) : null}
          <div className="divide-y">
            {notes.map((note) => (
              <div key={note.id} className="py-3">
                <p className="text-sm">{note.body}</p>
                <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                  {note.pinned ? "Pinned · " : ""}
                  {formatDate(note.createdAt, "en-US")}
                </p>
              </div>
            ))}
            {notes.length === 0 ? (
              <p className="text-sm text-[var(--color-stone-500)]">
                No private notes yet.
              </p>
            ) : null}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-medium">Relationship timeline</h2>
          <div className="divide-y">
            {[
              ...orders.map((item) => ({
                id: `order-${item.id}`,
                at: item.createdAt,
                title: `Order ${item.orderNumber}`,
                detail: item.status.replaceAll("_", " "),
              })),
              ...appointments.map((item) => ({
                id: `appointment-${item.id}`,
                at: item.startsAt,
                title: item.type.replaceAll("_", " "),
                detail: item.status.replaceAll("_", " "),
              })),
              ...garments.map((item) => ({
                id: `garment-${item.id}`,
                at: item.createdAt,
                title: `${item.brand ? `${item.brand} ` : ""}${item.garmentType}`,
                detail: "Garment recorded",
              })),
            ]
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((item) => (
                <div key={item.id} className="py-3">
                  <p className="font-medium capitalize">{item.title}</p>
                  <p className="text-sm capitalize text-[var(--color-stone-500)]">
                    {formatDate(item.at, "en-US")} · {item.detail}
                  </p>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Alterations
        </h2>
        {alterations.length === 0 ? (
          <p className="mb-4 text-sm text-[var(--color-stone-500)]">
            No alteration work orders yet.
          </p>
        ) : (
          <Card className="mb-4 divide-y divide-[var(--color-stone-100)] p-0">
            {alterations.map((alteration) => {
              const garment = garmentById.get(alteration.physicalGarmentId);
              return (
                <Link
                  key={alteration.id}
                  href={`/alterations/${alteration.id}`}
                  className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-[var(--color-stone-50)]"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-stone-900)]">
                      {alteration.workOrderNumber} ·{" "}
                      {garment
                        ? `${garment.brand ? `${garment.brand} ` : ""}${garment.garmentType}`
                        : "Garment"}
                    </p>
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {formatDate(alteration.createdAt, "en-US")}
                      {alteration.dueDate
                        ? ` · Due ${formatDate(alteration.dueDate, "en-US")}`
                        : ""}
                    </p>
                  </div>
                  <AlterationStatusBadge status={alteration.status} />
                </Link>
              );
            })}
          </Card>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Garments & fitting history
        </h2>
        {garments.length === 0 ? (
          <Card className="mb-4 border-dashed">
            <p className="text-sm font-medium text-[var(--color-stone-900)]">
              Measurement intake
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-stone-600)]">
              No physical garments have been recorded yet. Fit observations are
              captured against a garment during intake or a fitting note — never
              as a generic customer measurement (see Wardrobe above). Before
              confirming a made-to-measure order, record at minimum: chest,
              waist and sleeve length.
            </p>
            {canManage ? (
              <Link
                href={`/alterations/new?customerId=${customer.id}`}
                className={buttonVariants({
                  variant: "outline",
                  className: "mt-4",
                })}
              >
                Begin garment intake
              </Link>
            ) : null}
          </Card>
        ) : (
          <Card className="mb-4 divide-y divide-[var(--color-stone-100)] p-0">
            {garments.map((garment) => {
              const observations =
                observationsByGarmentId.get(garment.id) ?? [];
              return (
                <div key={garment.id} className="px-6 py-4">
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {formatDate(garment.createdAt, "en-US")} ·{" "}
                    {garment.categoryCode}
                  </p>
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {garment.brand ? `${garment.brand} ` : ""}
                    {garment.garmentType}
                  </p>
                  <p className="text-sm text-[var(--color-stone-700)]">
                    {garment.description}
                  </p>
                  {observations.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--color-stone-100)] pt-2">
                      {observations.map((observation) => (
                        <p
                          key={observation.id}
                          className="text-xs text-[var(--color-stone-600)]"
                        >
                          <span className="font-medium">
                            {observation.area}
                          </span>{" "}
                          {observation.observation}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
