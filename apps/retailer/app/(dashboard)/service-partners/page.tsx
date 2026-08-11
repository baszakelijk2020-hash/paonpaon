import {
  CustomerRepository,
  ServicePartnerRepository,
  WardrobeRepository,
} from "@paon/database";
import {
  PARTNER_CAPABILITIES,
  PARTNER_CUSTODY_STATES,
  type CurrencyCode,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { formatMoney } from "@paon/utils";
import Link from "next/link";

import {
  addInvoiceLine,
  approveInvoice,
  createEngagement,
  createInvoice,
  createPartner,
  reconcileInvoice,
  transitionCustodyForEngagement,
} from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const CUSTODY_TONE: Record<string, "neutral" | "success" | "warning"> = {
  with_retailer: "neutral",
  in_transit_to_partner: "warning",
  with_partner: "warning",
  in_transit_to_retailer: "warning",
  returned_to_retailer: "success",
  released_to_customer: "success",
};

export default async function ServicePartnersPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const repo = new ServicePartnerRepository(supabase);
  const customerRepo = new CustomerRepository(supabase);
  const wardrobeRepo = new WardrobeRepository(supabase);

  const [partners, engagements, invoices, customers] = await Promise.all([
    repo.findPartnersByRetailer(session.retailerId),
    repo.findEngagementsByRetailer(session.retailerId),
    repo.findInvoicesByRetailer(session.retailerId),
    customerRepo.findByRetailer(session.retailerId),
  ]);

  const partnersById = new Map(
    partners.map((partner) => [partner.id, partner]),
  );
  const customersById = new Map(
    customers.map((customer) => [customer.id, customer.fullName]),
  );

  const wardrobeOptions = (
    await Promise.all(
      customers.map(async (customer) => {
        const items = await wardrobeRepo.findByCustomer(customer.id);
        return items.map((item) => ({
          id: item.id,
          customerId: customer.id,
          label: `${customer.fullName} — ${item.displayName}`,
        }));
      }),
    )
  ).flat();

  const invoiceLinesByInvoice = new Map(
    await Promise.all(
      invoices.map(
        async (invoice) =>
          [invoice.id, await repo.findInvoiceLines(invoice.id)] as const,
      ),
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Service partners
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Preferred Tailoring&rsquo;s partner network — dry cleaning, alteration
          and repair sent outside the house, tracked from custody to invoice.
          Approving an invoice never initiates a payout.
        </p>
        <Link
          href="/service-partners/calendar"
          className="mt-3 inline-flex text-sm font-medium text-[var(--color-stone-700)] underline underline-offset-4"
        >
          View weekly service calendar
        </Link>
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Partners
        </h2>
        {partners.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No partners yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-stone-200)]">
            {partners.map((partner) => (
              <li
                key={partner.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {partner.displayName}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {partner.capabilities.join(", ")} · {partner.turnaroundDays}
                    d turnaround
                    {partner.contactEmail ? ` · ${partner.contactEmail}` : ""}
                  </p>
                </div>
                <Badge tone={partner.active ? "success" : "neutral"}>
                  {partner.active ? "Active" : "Inactive"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--color-stone-700)]">
            Add a partner
          </summary>
          <form action={createPartner} className="mt-3 flex flex-col gap-3">
            <FormField label="Name" htmlFor="displayName">
              <Input
                id="displayName"
                name="displayName"
                required
                minLength={2}
              />
            </FormField>
            <FormField
              label="Capabilities"
              htmlFor="capabilities"
              labelledGroup
            >
              <div className="flex flex-wrap gap-3">
                {PARTNER_CAPABILITIES.map((capability) => (
                  <label
                    key={capability}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="capabilities"
                      value={capability}
                    />
                    {capability.replaceAll("_", " ")}
                  </label>
                ))}
              </div>
            </FormField>
            <FormField label="Turnaround (days)" htmlFor="turnaroundDays">
              <Input
                id="turnaroundDays"
                name="turnaroundDays"
                type="number"
                min={0}
                max={365}
                required
                defaultValue={3}
              />
            </FormField>
            <FormField label="Contact email (optional)" htmlFor="contactEmail">
              <Input id="contactEmail" name="contactEmail" type="email" />
            </FormField>
            <Button type="submit" className="self-start">
              Add partner
            </Button>
          </form>
        </details>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Engagements
        </h2>
        {engagements.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No garments sent out yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {engagements.map((engagement) => (
              <li
                key={engagement.id}
                className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {engagement.jobReference} ·{" "}
                    {partnersById.get(engagement.partnerId)?.displayName ??
                      "Partner"}{" "}
                    · {customersById.get(engagement.customerId) ?? "Client"}
                  </p>
                  <Badge
                    tone={CUSTODY_TONE[engagement.custodyState] ?? "neutral"}
                  >
                    {engagement.custodyState.replaceAll("_", " ")}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-stone-500)]">
                  {engagement.capability.replaceAll("_", " ")} · due{" "}
                  {engagement.dueOn}
                </p>
                <form
                  action={transitionCustodyForEngagement.bind(
                    null,
                    engagement.id,
                  )}
                  className="flex flex-wrap items-end gap-2"
                >
                  <FormField
                    label="Move to"
                    htmlFor={`toState-${engagement.id}`}
                  >
                    <Select
                      id={`toState-${engagement.id}`}
                      name="toState"
                      required
                    >
                      {PARTNER_CUSTODY_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state.replaceAll("_", " ")}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField
                    label="Condition note (required on return)"
                    htmlFor={`conditionNote-${engagement.id}`}
                  >
                    <Input
                      id={`conditionNote-${engagement.id}`}
                      name="conditionNote"
                      className="w-64"
                    />
                  </FormField>
                  <Button type="submit" size="sm">
                    Record
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--color-stone-700)]">
            Send a garment to a partner
          </summary>
          <form
            action={createEngagement}
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
            <FormField label="Partner" htmlFor="partnerId">
              <Select id="partnerId" name="partnerId" required>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.displayName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Capability" htmlFor="capability">
              <Select id="capability" name="capability" required>
                {PARTNER_CAPABILITIES.map((capability) => (
                  <option key={capability} value={capability}>
                    {capability.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Garment"
              htmlFor="wardrobeItemId"
              hint="From a customer's digital wardrobe"
            >
              <Select
                id="wardrobeItemId"
                name="wardrobeItemAndCustomer"
                required
              >
                {wardrobeOptions.map((option) => (
                  <option
                    key={option.id}
                    value={`${option.id}:${option.customerId}`}
                  >
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Job reference" htmlFor="jobReference">
              <Input id="jobReference" name="jobReference" required />
            </FormField>
            <FormField label="Due on" htmlFor="dueOn">
              <Input id="dueOn" name="dueOn" type="date" required />
            </FormField>
            <FormField
              label="Instructions"
              htmlFor="instructions"
              hint="Repeated to the partner exactly as written"
            >
              <textarea
                id="instructions"
                name="instructions"
                required
                rows={2}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-stone-300)] p-2 text-sm"
              />
            </FormField>
            <Button type="submit" className="self-start sm:col-span-2">
              Send to partner
            </Button>
          </form>
        </details>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Invoices
        </h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-[var(--color-stone-500)]">
            No partner invoices yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {invoices.map((invoice) => {
              const lines = invoiceLinesByInvoice.get(invoice.id) ?? [];
              const reconciliation =
                "reconciled" in invoice.reconciliation
                  ? invoice.reconciliation
                  : null;
              return (
                <li
                  key={invoice.id}
                  className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--color-stone-900)]">
                      {invoice.partnerInvoiceReference} ·{" "}
                      {partnersById.get(invoice.partnerId)?.displayName ??
                        "Partner"}
                    </p>
                    <Badge
                      tone={
                        invoice.state === "approved"
                          ? "success"
                          : invoice.state === "disputed"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {invoice.state}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {invoice.periodStart} – {invoice.periodEnd}
                  </p>
                  <ul className="flex flex-col gap-1 text-xs text-[var(--color-stone-600)]">
                    {lines.map((line) => (
                      <li key={line.id}>
                        {line.jobReference} —{" "}
                        {formatMoney(
                          {
                            amountMinorUnits: line.amountMinorUnits,
                            currency: invoice.currency as CurrencyCode,
                          },
                          "en-US",
                        )}
                      </li>
                    ))}
                    {lines.length === 0 ? <li>No lines yet.</li> : null}
                  </ul>
                  {reconciliation ? (
                    <p className="text-xs text-[var(--color-stone-500)]">
                      {reconciliation.reconciled
                        ? "Reconciled — matches recorded costs."
                        : `Not reconciled: ${reconciliation.unmatchedInvoiceLines.length} unmatched, ${reconciliation.uninvoicedCosts.length} uninvoiced, ${reconciliation.amountVariances.length} variance(s).`}
                    </p>
                  ) : null}
                  <form
                    action={addInvoiceLine}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <FormField
                      label="Job reference"
                      htmlFor={`line-ref-${invoice.id}`}
                    >
                      <Input
                        id={`line-ref-${invoice.id}`}
                        name="jobReference"
                        required
                      />
                    </FormField>
                    <FormField
                      label="Amount (minor units)"
                      htmlFor={`line-amount-${invoice.id}`}
                    >
                      <Input
                        id={`line-amount-${invoice.id}`}
                        name="amountMinorUnits"
                        type="number"
                        min={0}
                        required
                        className="w-32"
                      />
                    </FormField>
                    <Button type="submit" size="sm" variant="secondary">
                      Add line
                    </Button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    <form action={reconcileInvoice.bind(null, invoice.id)}>
                      <Button type="submit" size="sm" variant="secondary">
                        Reconcile
                      </Button>
                    </form>
                    {invoice.state === "reconciled" ? (
                      <form action={approveInvoice.bind(null, invoice.id)}>
                        <Button type="submit" size="sm">
                          Approve
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--color-stone-700)]">
            Log a partner invoice
          </summary>
          <form
            action={createInvoice}
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
            <FormField label="Partner" htmlFor="invoicePartnerId">
              <Select id="invoicePartnerId" name="partnerId" required>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.displayName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Partner invoice reference"
              htmlFor="partnerInvoiceReference"
            >
              <Input
                id="partnerInvoiceReference"
                name="partnerInvoiceReference"
                required
              />
            </FormField>
            <FormField label="Period start" htmlFor="periodStart">
              <Input id="periodStart" name="periodStart" type="date" required />
            </FormField>
            <FormField label="Period end" htmlFor="periodEnd">
              <Input id="periodEnd" name="periodEnd" type="date" required />
            </FormField>
            <FormField label="Currency" htmlFor="currency">
              <Input
                id="currency"
                name="currency"
                required
                maxLength={3}
                defaultValue="USD"
                className="w-20 uppercase"
              />
            </FormField>
            <Button type="submit" className="self-start sm:col-span-2">
              Log invoice
            </Button>
          </form>
        </details>
      </Card>
    </div>
  );
}
