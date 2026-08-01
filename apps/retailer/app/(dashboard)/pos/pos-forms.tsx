"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  addSaleLine,
  cancelSale,
  openSale,
  recordCardPayment,
  returnSaleLine,
  takeCash,
  type PosActionState,
} from "./actions";

const initial: PosActionState = {};

export interface Option {
  readonly id: string;
  readonly label: string;
}

function Feedback({ state }: { readonly state: PosActionState }) {
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

/** Opens a sale at a chosen till. */
export function OpenSaleForm({
  locations,
}: {
  readonly locations: readonly Option[];
}) {
  const [state, action, pending] = useActionState(openSale, initial);
  return (
    <form action={action} className="flex flex-col gap-3" id="pos-open-form">
      <FormField label="Till" htmlFor="open-location">
        <Select id="open-location" name="locationId" defaultValue="">
          <option value="" disabled>
            Choose a till
          </option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.label}
            </option>
          ))}
        </Select>
      </FormField>
      <Button type="submit" disabled={pending}>
        Start a sale
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/**
 * Adds a line. The item picker is only meaningful for a garment, so it is
 * always shown but plainly labelled as optional for the other two kinds
 * rather than appearing and vanishing under the cursor.
 */
export function AddLineForm({
  transactionId,
  locationId,
  items,
}: {
  readonly transactionId: string;
  readonly locationId: string;
  readonly items: readonly Option[];
}) {
  const [state, action, pending] = useActionState(addSaleLine, initial);
  return (
    <form action={action} className="flex flex-col gap-3" id="pos-add-form">
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="locationId" value={locationId} />
      <FormField label="What is being sold" htmlFor="line-kind">
        <Select id="line-kind" name="kind" defaultValue="rtw">
          <option value="rtw">A garment from stock</option>
          <option value="alteration_service">Alteration work</option>
          <option value="mtm">Made to measure</option>
        </Select>
      </FormField>
      <FormField
        label="Item"
        htmlFor="line-variant"
        hint="Only needed for a garment from stock."
      >
        <Select id="line-variant" name="variantId" defaultValue="">
          <option value="">Not a stock item</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="How many" htmlFor="line-quantity">
          <Input
            id="line-quantity"
            name="quantity"
            type="number"
            min={1}
            step={1}
            defaultValue={1}
          />
        </FormField>
        <FormField label="Price each" htmlFor="line-price" hint="In euros.">
          <Input
            id="line-price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue=""
          />
        </FormField>
      </div>
      <Button type="submit" disabled={pending}>
        Add to sale
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Cash, the tender that needs no processor. */
export function TakeCashForm({
  transactionId,
  locationId,
  totalLabel,
}: {
  readonly transactionId: string;
  readonly locationId: string;
  readonly totalLabel: string;
}) {
  const [state, action, pending] = useActionState(takeCash, initial);
  return (
    <form action={action} className="flex flex-col gap-3" id="pos-cash-form">
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="locationId" value={locationId} />
      <p className="text-sm text-[var(--color-stone-600)]">
        Take {totalLabel} in cash and finish the sale. The stock moves when the
        money does, not before.
      </p>
      <Button type="submit" disabled={pending}>
        Take cash and finish
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/**
 * Card is present and honest about being unavailable. Hiding it would leave
 * someone hunting for a button; refusing it explains itself.
 */
export function CardPaymentForm({
  transactionId,
}: {
  readonly transactionId: string;
}) {
  const [state, action, pending] = useActionState(recordCardPayment, initial);
  return (
    <form action={action} className="flex flex-col gap-3" id="pos-card-form">
      <input type="hidden" name="transactionId" value={transactionId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Terminal reference"
          htmlFor="card-reference"
          hint="From the terminal receipt. Never the card number."
        >
          <Input id="card-reference" name="reference" defaultValue="" />
        </FormField>
        <FormField label="Amount taken" htmlFor="card-amount" hint="In euros.">
          <Input
            id="card-amount"
            name="amount"
            type="number"
            min={0}
            step="0.01"
            defaultValue=""
          />
        </FormField>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        Record a card payment
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Cancels an unfinished sale, releasing every hold. */
export function CancelSaleForm({
  transactionId,
  locationId,
}: {
  readonly transactionId: string;
  readonly locationId: string;
}) {
  const [state, action, pending] = useActionState(cancelSale, initial);
  return (
    <form action={action} className="flex flex-col gap-3" id="pos-cancel-form">
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="locationId" value={locationId} />
      <FormField
        label="Why is it being cancelled"
        htmlFor="cancel-reason"
        hint="So the day can be read back later."
      >
        <Input id="cancel-reason" name="reason" defaultValue="" />
      </FormField>
      <Button type="submit" variant="secondary" disabled={pending}>
        Cancel this sale
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Returns one line of a finished sale. */
export function ReturnLineForm({
  transactionId,
  locationId,
  lineId,
  kind,
}: {
  readonly transactionId: string;
  readonly locationId: string;
  readonly lineId: string;
  readonly kind: string;
}) {
  const [state, action, pending] = useActionState(returnSaleLine, initial);
  return (
    <form
      action={action}
      className="flex flex-col gap-2"
      data-return-line={lineId}
    >
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="lineId" value={lineId} />
      {kind === "alteration_service" ? (
        <label className="flex items-center gap-2 text-sm text-[var(--color-stone-600)]">
          <input
            type="checkbox"
            name="servicePerformed"
            id={`performed-${lineId}`}
            className="size-4 rounded-[var(--radius-xs)] border-[var(--color-stone-300)]"
          />
          The work has already been done
        </label>
      ) : null}
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={pending}
        id={`return-${lineId}`}
      >
        Return this
      </Button>
      <Feedback state={state} />
    </form>
  );
}
