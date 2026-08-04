"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  confirmOrder,
  createListing,
  createPartner,
  recordClick,
  refundOrder,
  setListingActive,
  type NetworkActionState,
} from "./actions";

const initial: NetworkActionState = {};

export interface Option {
  readonly id: string;
  readonly label: string;
}

function Feedback({ state }: { readonly state: NetworkActionState }) {
  if (state.formError) {
    return (
      <p role="alert" className="text-sm text-[var(--color-danger-500)]">
        {state.formError}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="text-sm text-[var(--color-stone-500)]">
        {state.notice}
      </p>
    );
  }
  return null;
}

export function CreatePartnerForm() {
  const [state, action, pending] = useActionState(createPartner, initial);
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      id="create-partner-form"
    >
      <FormField label="Partner name" htmlFor="partner-display-name">
        <Input id="partner-display-name" name="displayName" />
      </FormField>
      <FormField label="Partner key" htmlFor="partner-key">
        <Input id="partner-key" name="partnerKey" />
      </FormField>
      <FormField label="Disclosure text" htmlFor="partner-disclosure">
        <textarea
          id="partner-disclosure"
          name="disclosureText"
          rows={2}
          placeholder="Paid placement — PAON receives a commission on qualifying purchases."
          className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-stone-400)]"
        />
      </FormField>
      <Button type="submit" disabled={pending}>
        Add partner
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function CreateListingForm({
  partners,
}: {
  readonly partners: readonly Option[];
}) {
  const [state, action, pending] = useActionState(createListing, initial);
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      id="create-listing-form"
    >
      <FormField label="Partner" htmlFor="listing-partner">
        <Select id="listing-partner" name="partnerId" defaultValue="">
          <option value="" disabled>
            Choose a partner
          </option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Listing title" htmlFor="listing-title">
        <Input id="listing-title" name="title" />
      </FormField>
      <FormField label="Description (optional)" htmlFor="listing-description">
        <textarea
          id="listing-description"
          name="description"
          rows={2}
          className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-stone-400)]"
        />
      </FormField>
      <FormField label="Destination link" htmlFor="listing-destination">
        <Input id="listing-destination" name="destinationUrl" type="url" />
      </FormField>
      <Button type="submit" disabled={pending}>
        Create listing
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function ToggleListingActiveForm({
  listingId,
  active,
}: {
  readonly listingId: string;
  readonly active: boolean;
}) {
  const [state, action, pending] = useActionState(setListingActive, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button
        type="submit"
        disabled={pending}
        id={`toggle-listing-${listingId}`}
        variant={active ? "secondary" : "primary"}
      >
        {active ? "Deactivate" : "Activate"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

function AttributionSnapshot({
  state,
}: {
  readonly state: NetworkActionState;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Feedback state={state} />
      {state.outcome ? (
        <p
          data-attribution-state={state.outcome.state}
          className="text-xs text-[var(--color-stone-500)]"
        >
          Attributable: €
          {(state.outcome.attributableMinorUnits / 100).toFixed(2)}
        </p>
      ) : null}
      {state.partnerPayloads ? (
        <pre
          data-partner-payload
          className="overflow-x-auto rounded-[var(--radius-md)] bg-[var(--color-stone-100)] p-3 text-xs"
        >
          {JSON.stringify(state.partnerPayloads, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

/**
 * Drives one demo conversion journey — click, confirm, refund — for a
 * chosen customer against one listing, so the honesty properties
 * (pseudonymous partner payload, holding before confirmed, refund reverses
 * to zero) are provable end to end without a live partner integration.
 */
function CustomerSelect({
  id,
  customers,
}: {
  readonly id: string;
  readonly customers: readonly Option[];
}) {
  return (
    <Select id={id} name="customerId" defaultValue="">
      <option value="" disabled>
        Choose a customer
      </option>
      {customers.map((customer) => (
        <option key={customer.id} value={customer.id}>
          {customer.label}
        </option>
      ))}
    </Select>
  );
}

export function AttributionDemoPanel({
  listingId,
  partnerId,
  customers,
}: {
  readonly listingId: string;
  readonly partnerId: string;
  readonly customers: readonly Option[];
}) {
  const [clickState, clickAction, clickPending] = useActionState(
    recordClick,
    initial,
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmOrder,
    initial,
  );
  const [refundState, refundAction, refundPending] = useActionState(
    refundOrder,
    initial,
  );

  return (
    <div className="flex flex-col gap-4" data-attribution-demo={listingId}>
      <form action={clickAction} className="flex flex-col gap-2">
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="partnerId" value={partnerId} />
        <FormField label="Customer" htmlFor={`click-customer-${listingId}`}>
          <CustomerSelect
            id={`click-customer-${listingId}`}
            customers={customers}
          />
        </FormField>
        <Button
          type="submit"
          disabled={clickPending}
          id={`record-click-${listingId}`}
        >
          Record click
        </Button>
        <AttributionSnapshot state={clickState} />
      </form>

      <form action={confirmAction} className="flex flex-col gap-2">
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="partnerId" value={partnerId} />
        <FormField label="Customer" htmlFor={`confirm-customer-${listingId}`}>
          <CustomerSelect
            id={`confirm-customer-${listingId}`}
            customers={customers}
          />
        </FormField>
        <FormField label="Order amount (EUR)" htmlFor={`amount-${listingId}`}>
          <Input
            type="number"
            step="0.01"
            name="amountEuros"
            id={`amount-${listingId}`}
          />
        </FormField>
        <Button
          type="submit"
          disabled={confirmPending}
          id={`confirm-order-${listingId}`}
        >
          Confirm order
        </Button>
        <AttributionSnapshot state={confirmState} />
      </form>

      <form action={refundAction} className="flex flex-col gap-2">
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="partnerId" value={partnerId} />
        <FormField label="Customer" htmlFor={`refund-customer-${listingId}`}>
          <CustomerSelect
            id={`refund-customer-${listingId}`}
            customers={customers}
          />
        </FormField>
        <Button
          type="submit"
          disabled={refundPending}
          id={`refund-order-${listingId}`}
        >
          Refund order
        </Button>
        <AttributionSnapshot state={refundState} />
      </form>
    </div>
  );
}
