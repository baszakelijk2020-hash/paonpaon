"use client";

import {
  GARMENT_CATEGORIES,
  WARDROBE_CONDITION_STATES,
  wardrobeConditionLabel,
  wardrobeOwnershipLabel,
  type PhysicalGarment,
  type WardrobeItem,
  type WardrobeOwnershipEvent,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import {
  addWardrobeAdvisorNote,
  createRetailerPurchaseWardrobeItem,
  updateCustomerWardrobeItem,
  type RetailerWardrobeActionState,
} from "./wardrobe-actions";

function formatCategory(code: string): string {
  return code.charAt(0).toUpperCase() + code.slice(1);
}

function AdvisorWardrobeItemRow({
  customerId,
  item,
  history,
}: {
  customerId: string;
  item: WardrobeItem;
  history: readonly WardrobeOwnershipEvent[];
}) {
  const initialState: RetailerWardrobeActionState = { fieldErrors: {} };
  const [updateState, updateAction, updatePending] = useActionState(
    updateCustomerWardrobeItem,
    initialState,
  );
  const [noteState, noteAction, notePending] = useActionState(
    addWardrobeAdvisorNote,
    initialState,
  );
  const advisorNotes = history.filter((event) => event.eventType === "advisor_note");

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
          {formatCategory(item.categoryCode)}
        </p>
        <h3 className="text-base font-medium text-[var(--color-stone-900)]">
          {item.title}
        </h3>
        <p className="text-sm text-[var(--color-stone-500)]">
          {wardrobeOwnershipLabel(item.ownershipSource)} ·{" "}
          {wardrobeConditionLabel(item.state.conditionState)}
        </p>
        {item.state.fitNotes ? (
          <p className="mt-2 text-sm text-[var(--color-stone-600)]">
            Customer fit note: {item.state.fitNotes}
          </p>
        ) : null}
      </div>

      {updateState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {updateState.formError}
        </p>
      ) : null}
      {updateState.success ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Wardrobe item updated.
        </p>
      ) : null}

      <form action={updateAction} className="grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="itemId" value={item.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Condition</span>
          <select
            name="conditionState"
            defaultValue={item.state.conditionState}
            className="rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
          >
            {WARDROBE_CONDITION_STATES.map((state) => (
              <option key={state} value={state}>
                {wardrobeConditionLabel(state)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Collaboration fit note</span>
          <textarea
            name="fitNotes"
            rows={2}
            defaultValue={item.state.fitNotes ?? ""}
            className="rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={updatePending}>
            Update item
          </Button>
        </div>
      </form>

      {advisorNotes.length > 0 ? (
        <ul className="border-t border-[var(--color-stone-100)] pt-3 text-sm text-[var(--color-stone-600)]">
          {advisorNotes.map((event) => (
            <li key={event.id}>
              Advisor note ·{" "}
              {typeof event.detail.note === "string"
                ? event.detail.note
                : "—"}
            </li>
          ))}
        </ul>
      ) : null}

      {noteState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {noteState.formError}
        </p>
      ) : null}
      {noteState.success ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Note added.
        </p>
      ) : null}

      <form action={noteAction} className="flex flex-col gap-2">
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="itemId" value={item.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Add advisor note</span>
          <textarea
            name="note"
            rows={2}
            required
            className="rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={notePending}>
          Save note
        </Button>
      </form>
    </Card>
  );
}

export function CustomerWardrobePanel({
  customerId,
  items,
  garments,
  historyByItemId,
}: {
  customerId: string;
  items: readonly WardrobeItem[];
  garments: readonly PhysicalGarment[];
  historyByItemId: Readonly<Record<string, readonly WardrobeOwnershipEvent[]>>;
}) {
  const initialState: RetailerWardrobeActionState = { fieldErrors: {} };
  const [createState, createAction, createPending] = useActionState(
    createRetailerPurchaseWardrobeItem,
    initialState,
  );

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Customer wardrobe
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Relationship-scoped garments the client owns or added. Official fitting
          records remain under Garments &amp; fitting history.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-stone-500)]">
          No wardrobe items yet. Link a purchase or physical garment below.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <AdvisorWardrobeItemRow
                customerId={customerId}
                item={item}
                history={historyByItemId[item.id] ?? []}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-[var(--color-stone-100)] pt-4">
        <h3 className="text-sm font-medium text-[var(--color-stone-800)]">
          Link retailer purchase
        </h3>
        {createState.formError ? (
          <p role="alert" className="mt-2 text-sm text-[var(--color-danger-500)]">
            {createState.formError}
          </p>
        ) : null}
        {createState.success ? (
          <p role="status" className="mt-2 text-sm text-[var(--color-success-500)]">
            Wardrobe item linked.
          </p>
        ) : null}
        <form action={createAction} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="customerId" value={customerId} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Category</span>
            <select
              name="categoryCode"
              required
              className="rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
            >
              {GARMENT_CATEGORIES.map((code) => (
                <option key={code} value={code}>
                  {formatCategory(code)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Title</span>
            <input
              name="title"
              required
              className="rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium">Physical garment (optional link)</span>
            <select
              name="physicalGarmentId"
              defaultValue=""
              className="rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
            >
              <option value="">None</option>
              {garments.map((garment) => (
                <option key={garment.id} value={garment.id}>
                  {garment.description} ({formatCategory(garment.categoryCode)})
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={createPending}>
              Link to wardrobe
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
