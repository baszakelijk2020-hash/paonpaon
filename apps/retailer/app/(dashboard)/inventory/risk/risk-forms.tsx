"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  approveWriteOff,
  recordSweep,
  requestWriteOffApproval,
  resolveDiscrepancy,
  type RiskActionState,
} from "./actions";

const initial: RiskActionState = {};

export interface Option {
  readonly id: string;
  readonly label: string;
}

function Feedback({ state }: { readonly state: RiskActionState }) {
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

/** Raises a write-off for a second signature. Moves no stock. */
export function RequestWriteOffForm({
  items,
  locations,
}: {
  readonly items: readonly Option[];
  readonly locations: readonly Option[];
}) {
  const [state, action, pending] = useActionState(
    requestWriteOffApproval,
    initial,
  );
  return (
    <form action={action} className="flex flex-col gap-3" id="writeoff-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Item" htmlFor="writeoff-variant">
          <Select id="writeoff-variant" name="variantId" defaultValue="">
            <option value="" disabled>
              Choose an item
            </option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Location" htmlFor="writeoff-location">
          <Select id="writeoff-location" name="locationId" defaultValue="">
            <option value="" disabled>
              Choose a location
            </option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="How many to write off"
          htmlFor="writeoff-quantity"
          hint="A negative whole number."
        >
          <Input
            id="writeoff-quantity"
            name="quantity"
            type="number"
            max={-1}
            step={1}
            defaultValue={-1}
          />
        </FormField>
        <FormField
          label="Worth each"
          htmlFor="writeoff-price"
          hint="In euros. This decides whether a second signature is needed."
        >
          <Input
            id="writeoff-price"
            name="unitPrice"
            type="number"
            min={0}
            step="0.01"
            defaultValue=""
          />
        </FormField>
      </div>
      <Button type="submit" disabled={pending}>
        Send for approval
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/**
 * Approves one raised write-off. Shown to everyone so the queue is visible,
 * and refused with a readable reason when the person looking at it is the one
 * who raised it or is not a manager.
 */
export function ApproveWriteOffForm({
  flagId,
  locationId,
  items,
}: {
  readonly flagId: string;
  readonly locationId: string;
  readonly items: readonly Option[];
}) {
  const [state, action, pending] = useActionState(approveWriteOff, initial);
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      data-approve-flag={flagId}
    >
      <input type="hidden" name="flagId" value={flagId} />
      <input type="hidden" name="locationId" value={locationId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Item" htmlFor={`approve-variant-${flagId}`}>
          <Select
            id={`approve-variant-${flagId}`}
            name="variantId"
            defaultValue=""
          >
            <option value="" disabled>
              Choose the item
            </option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="How many" htmlFor={`approve-quantity-${flagId}`}>
          <Input
            id={`approve-quantity-${flagId}`}
            name="quantity"
            type="number"
            max={-1}
            step={1}
            defaultValue={-1}
          />
        </FormField>
      </div>
      <FormField
        label="What happened"
        htmlFor={`approve-reason-${flagId}`}
        hint="Required. This is what makes the write-off explicable later."
      >
        <Input id={`approve-reason-${flagId}`} name="reason" defaultValue="" />
      </FormField>
      <Button type="submit" disabled={pending} id={`approve-${flagId}`}>
        Approve and write off
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Records a reader sweep. Writes no balance, by design. */
export function RecordSweepForm({
  locations,
}: {
  readonly locations: readonly Option[];
}) {
  const [state, action, pending] = useActionState(recordSweep, initial);
  return (
    <form action={action} className="flex flex-col gap-3" id="sweep-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Location" htmlFor="sweep-location">
          <Select id="sweep-location" name="locationId" defaultValue="">
            <option value="" disabled>
              Choose a location
            </option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Zone" htmlFor="sweep-zone" hint="e.g. floor, stock">
          <Input id="sweep-zone" name="zoneKey" defaultValue="floor" />
        </FormField>
      </div>
      <FormField
        label="Tags the reader saw"
        htmlFor="sweep-reads"
        hint="One per line. Add a confidence after the tag if the reader gives one, e.g. EPC-123 0.94."
      >
        <textarea
          id="sweep-reads"
          name="reads"
          rows={5}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] bg-white px-3 py-2 text-sm"
        />
      </FormField>
      <FormField
        label="Tags expected here"
        htmlFor="sweep-expected"
        hint="One per line. Anything expected and not seen is reported as unread, never as missing."
      >
        <textarea
          id="sweep-expected"
          name="expected"
          rows={4}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] bg-white px-3 py-2 text-sm"
        />
      </FormField>
      <Button type="submit" disabled={pending}>
        Record sweep
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Closes one discrepancy, with a stated reason. */
export function ResolveDiscrepancyForm({
  discrepancyId,
}: {
  readonly discrepancyId: string;
}) {
  const [state, action, pending] = useActionState(resolveDiscrepancy, initial);
  return (
    <form
      action={action}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      data-resolve-discrepancy={discrepancyId}
    >
      <input type="hidden" name="discrepancyId" value={discrepancyId} />
      <div className="flex-1">
        <FormField
          label="What did you find"
          htmlFor={`resolve-note-${discrepancyId}`}
        >
          <Input
            id={`resolve-note-${discrepancyId}`}
            name="note"
            defaultValue=""
          />
        </FormField>
      </div>
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        id={`resolve-${discrepancyId}`}
      >
        Close this
      </Button>
      <Feedback state={state} />
    </form>
  );
}
