"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  adjustFromCount,
  closeCount,
  holdStock,
  openCount,
  receiveStock,
  recordCount,
  reverseEntry,
  transferStock,
  type InventoryActionState,
} from "./actions";

const initial: InventoryActionState = {};

export interface Option {
  readonly id: string;
  readonly label: string;
}

function Feedback({ state }: { readonly state: InventoryActionState }) {
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

function ItemAndLocation({
  items,
  locations,
  idPrefix,
}: {
  readonly items: readonly Option[];
  readonly locations: readonly Option[];
  readonly idPrefix: string;
}) {
  return (
    <>
      <FormField label="Item" htmlFor={`${idPrefix}-variant`}>
        <Select id={`${idPrefix}-variant`} name="variantId">
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Location" htmlFor={`${idPrefix}-location`}>
        <Select id={`${idPrefix}-location`} name="locationId">
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.label}
            </option>
          ))}
        </Select>
      </FormField>
    </>
  );
}

/** Goods in. */
export function ReceiveForm({
  items,
  locations,
}: {
  readonly items: readonly Option[];
  readonly locations: readonly Option[];
}) {
  const [state, action, pending] = useActionState(receiveStock, initial);
  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <ItemAndLocation
          items={items}
          locations={locations}
          idPrefix="receive"
        />
        <FormField label="How many" htmlFor="receive-quantity">
          <Input
            id="receive-quantity"
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Recording…" : "Receive stock"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** Holds stock for a client. Refused when availability is short. */
export function HoldForm({
  items,
  locations,
}: {
  readonly items: readonly Option[];
  readonly locations: readonly Option[];
}) {
  const [state, action, pending] = useActionState(holdStock, initial);
  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <ItemAndLocation items={items} locations={locations} idPrefix="hold" />
        <FormField label="How many" htmlFor="hold-quantity">
          <Input
            id="hold-quantity"
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Holding…" : "Hold for a client"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** Moves stock between locations as two entries. */
export function TransferForm({
  items,
  locations,
}: {
  readonly items: readonly Option[];
  readonly locations: readonly Option[];
}) {
  const [state, action, pending] = useActionState(transferStock, initial);
  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Item" htmlFor="transfer-variant">
          <Select id="transfer-variant" name="variantId">
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="From" htmlFor="transfer-from">
          <Select id="transfer-from" name="fromLocationId">
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="To" htmlFor="transfer-to">
          <Select
            id="transfer-to"
            name="toLocationId"
            defaultValue={locations[1]?.id}
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="How many" htmlFor="transfer-quantity">
          <Input
            id="transfer-quantity"
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Moving…" : "Move stock"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** Undo one movement. Appends a correction rather than editing history. */
export function ReverseForm({ entryId }: { readonly entryId: string }) {
  const [state, action, pending] = useActionState(reverseEntry, initial);
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="entryId" value={entryId} />
      <div>
        <Button type="submit" size="sm" variant="ghost" disabled={pending}>
          {pending ? "Undoing…" : "Undo this movement"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function OpenCountForm({
  locations,
}: {
  readonly locations: readonly Option[];
}) {
  const [state, action, pending] = useActionState(openCount, initial);
  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Location"
          htmlFor="count-location"
          hint="A blind count does not show you the expected figure."
        >
          <Select id="count-location" name="locationId">
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Opening…" : "Start a stock count"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** Records what was physically on the shelf. */
export function RecordCountForm({
  sessionId,
  items,
}: {
  readonly sessionId: string;
  readonly items: readonly Option[];
}) {
  const [state, action, pending] = useActionState(recordCount, initial);
  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Item" htmlFor="countline-variant">
          <Select id="countline-variant" name="variantId">
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Counted" htmlFor="countline-quantity">
          <Input
            id="countline-quantity"
            name="countedQuantity"
            type="number"
            min={0}
            defaultValue={0}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Recording…" : "Record what you counted"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** The only path that changes a balance, and it demands a reason. */
export function AdjustForm({
  sessionId,
  locationId,
  variantId,
  suggestedQuantity,
}: {
  readonly sessionId: string;
  readonly locationId: string;
  readonly variantId: string;
  readonly suggestedQuantity: number;
}) {
  const [state, action, pending] = useActionState(adjustFromCount, initial);
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="variantId" value={variantId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Adjust by" htmlFor={`adjust-${variantId}`}>
          <Input
            id={`adjust-${variantId}`}
            name="adjustmentQuantity"
            type="number"
            defaultValue={suggestedQuantity}
          />
        </FormField>
        <div className="sm:col-span-2">
          <FormField
            label="What happened"
            htmlFor={`reason-${variantId}`}
            hint="Required. An unexplained adjustment cannot be told apart from shrinkage later."
          >
            <Input
              id={`reason-${variantId}`}
              name="reason"
              placeholder="One jacket found damaged and written off."
            />
          </FormField>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Recording…" : "Record adjustment"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function CloseCountForm({ sessionId }: { readonly sessionId: string }) {
  const [state, action, pending] = useActionState(closeCount, initial);
  return (
    <form action={action} className="mt-4 flex flex-col gap-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <div>
        <Button type="submit" size="sm" variant="ghost" disabled={pending}>
          {pending ? "Closing…" : "Close this count"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
