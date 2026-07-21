import {
  AIGenerationRepository,
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
import { formatDate } from "@paon/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

import { startConversation } from "../../messages/actions";
import { LifecycleBadge } from "../lifecycle-badge";

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
  ]);
  const canManage = retailerRoleAtLeast(
    session.retailerRole,
    "sales_associate",
  );
  const pinnedNote = notes.find((note) => note.pinned) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
              {customer.fullName}
            </h1>
            <LifecycleBadge stage={customer.lifecycleStage} />
          </div>
          <p className="text-sm text-[var(--color-stone-500)]">
            {customer.email ?? "No email on file"}
            {customer.phone ? ` · ${customer.phone}` : ""}
          </p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
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
              href={`/alterations/new?customerId=${customer.id}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              New alteration
            </Link>
            <Link
              href={`/wedding-parties/new?customerId=${customer.id}`}
              className={buttonVariants({ variant: "ghost" })}
            >
              Start a wedding party
            </Link>
          </div>
        ) : null}
      </div>

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Customer Portal
          </p>
          <Badge tone={customer.userId ? "success" : "neutral"}>
            {customer.userId ? "Linked" : "Not linked"}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Acquisition source
          </p>
          <p className="text-[var(--color-stone-900)]">
            {customer.acquisitionSource ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
            Added
          </p>
          <p className="text-[var(--color-stone-900)]">
            {formatDate(customer.createdAt, "en-US")}
          </p>
        </div>
      </Card>

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
                  className={`rounded-full border px-3 py-1 text-xs ${
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
          <h2 className="mb-3 text-lg font-medium">Clienteling notes</h2>
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
                className="min-h-24 rounded border p-3 text-sm"
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
          Garments & fitting history
        </h2>
        {garments.length === 0 ? (
          <p className="mb-4 text-sm text-[var(--color-stone-500)]">
            No physical garments have been recorded yet. Fit observations are
            captured during garment intake, never as generic customer
            measurements.
          </p>
        ) : (
          <Card className="mb-4 divide-y divide-[var(--color-stone-100)] p-0">
            {garments.map((garment) => (
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
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
