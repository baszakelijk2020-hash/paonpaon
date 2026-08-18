"use client";

import { Button } from "@paon/ui/components/Button";
import { DateTimePicker } from "@paon/ui/components/DateTimePicker";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState, useState } from "react";

import { createProposal, type CreateProposalActionState } from "./actions";

const initialState: CreateProposalActionState = {};

interface ItemRow {
  label: string;
  description: string;
}

interface AlternativeRow {
  label: string;
  description: string;
}

export function ProposalComposer({
  conversationId,
}: {
  readonly conversationId: string;
}) {
  const [items, setItems] = useState<ItemRow[]>([
    { label: "", description: "" },
  ]);
  const [alternatives, setAlternatives] = useState<AlternativeRow[]>([]);
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [state, formAction, isPending] = useActionState(
    createProposal.bind(null, conversationId),
    initialState,
  );

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addItemRow() {
    setItems((current) => [...current, { label: "", description: "" }]);
  }

  function removeItemRow(index: number) {
    setItems((current) =>
      current.filter((_, i) => i !== index && current.length > 1),
    );
  }

  function updateAlternative(index: number, patch: Partial<AlternativeRow>) {
    setAlternatives((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addAlternativeRow() {
    setAlternatives((current) => [...current, { label: "", description: "" }]);
  }

  function removeAlternativeRow(index: number) {
    setAlternatives((current) => current.filter((_, i) => i !== index));
  }

  const validItems = items.filter((row) => row.label.trim());
  const validAlternatives = alternatives.filter((row) => row.label.trim());

  return (
    <div className="mt-3 border-t border-[var(--color-stone-200)] pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-600)]">
        Create a new proposal
      </p>
      <form
        action={formAction}
        className="mt-2 grid gap-4"
        onSubmit={() => {
          // Items/alternatives serialized into hidden fields on every render
        }}
      >
        <input type="hidden" name="items" value={JSON.stringify(validItems)} />
        <input
          type="hidden"
          name="alternatives"
          value={JSON.stringify(validAlternatives)}
        />

        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-[var(--color-stone-900)]"
          >
            Title
          </label>
          <Input
            id="title"
            name="title"
            required
            maxLength={200}
            placeholder="e.g. Wedding look styling package"
            className="mt-1"
          />
        </div>

        <div>
          <label
            htmlFor="advisorNote"
            className="block text-sm font-medium text-[var(--color-stone-900)]"
          >
            Advisor note
          </label>
          <textarea
            id="advisorNote"
            name="advisorNote"
            required
            maxLength={2000}
            placeholder="Explain your recommendations and why they fit the customer's needs"
            className="mt-1 min-h-24 w-full rounded border border-[var(--color-stone-200)] p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-stone-900)] focus-visible:ring-offset-2"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="block text-sm font-medium text-[var(--color-stone-900)]">
              Items
            </div>
          </div>
          <p className="mt-1 text-xs text-[var(--color-stone-500)]">
            Products and looks the customer is considering
          </p>
          <div className="mt-2 flex flex-col gap-3">
            {items.map((row, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Label (e.g. White dress shirt)"
                  value={row.label}
                  onChange={(e) => updateItem(index, { label: e.target.value })}
                  maxLength={200}
                  className="flex-1"
                />
                <Input
                  placeholder="Description (optional)"
                  value={row.description}
                  onChange={(e) =>
                    updateItem(index, { description: e.target.value })
                  }
                  maxLength={1000}
                  className="flex-1"
                />
                {items.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs text-[var(--color-stone-500)] underline"
                    onClick={() => removeItemRow(index)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addItemRow}
            className="mt-2"
          >
            Add another item
          </Button>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="block text-sm font-medium text-[var(--color-stone-900)]">
              Alternatives (optional)
            </div>
          </div>
          <p className="mt-1 text-xs text-[var(--color-stone-500)]">
            Other options if the customer wants to explore further
          </p>
          <div className="mt-2 flex flex-col gap-3">
            {alternatives.map((row, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Label (e.g. Beige dress shirt)"
                  value={row.label}
                  onChange={(e) =>
                    updateAlternative(index, { label: e.target.value })
                  }
                  maxLength={200}
                  className="flex-1"
                />
                <Input
                  placeholder="Description (optional)"
                  value={row.description}
                  onChange={(e) =>
                    updateAlternative(index, { description: e.target.value })
                  }
                  maxLength={1000}
                  className="flex-1"
                />
                <button
                  type="button"
                  className="text-xs text-[var(--color-stone-500)] underline"
                  onClick={() => removeAlternativeRow(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addAlternativeRow}
            className="mt-2"
          >
            Add another alternative
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="priceAmount"
              className="block text-sm font-medium text-[var(--color-stone-900)]"
            >
              Price amount (optional)
            </label>
            <Input
              id="priceAmount"
              name="priceAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 350.00"
              value={priceAmount}
              onChange={(e) => setPriceAmount(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor="priceCurrency"
              className="block text-sm font-medium text-[var(--color-stone-900)]"
            >
              Currency (optional)
            </label>
            <Input
              id="priceCurrency"
              name="priceCurrency"
              maxLength={3}
              value={priceCurrency}
              onChange={(e) => setPriceCurrency(e.target.value.toUpperCase())}
              placeholder="USD"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="appointmentOffered"
            className="flex items-center gap-2"
          >
            <input
              id="appointmentOffered"
              type="checkbox"
              name="appointmentOffered"
              value="true"
            />
            <span className="text-sm font-medium text-[var(--color-stone-900)]">
              Appointment offered
            </span>
          </label>
          <p className="mt-1 text-xs text-[var(--color-stone-500)]">
            Check if you&apos;re offering to book an appointment as part of this
            proposal
          </p>
        </div>

        <div>
          <FormField label="Expires at" htmlFor="expiresAt" labelledGroup>
            <DateTimePicker name="expiresAt" label="Expires at" />
          </FormField>
          <p className="mt-1 text-xs text-[var(--color-stone-500)]">
            When should this proposal expire? (e.g., in a few days)
          </p>
        </div>

        {state.formError ? (
          <p role="alert" className="text-xs text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}

        <Button type="submit" disabled={isPending || validItems.length === 0}>
          {isPending ? "Creating…" : "Create proposal"}
        </Button>
      </form>
    </div>
  );
}
