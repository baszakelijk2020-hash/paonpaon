"use client";

import {
  GARMENT_CATEGORIES,
  WARDROBE_CONDITION_STATES,
  WARDROBE_WEAR_FREQUENCIES,
  wardrobeConditionLabel,
  wardrobeOwnershipLabel,
  type WardrobeItem,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import {
  archiveWardrobeItem,
  createExternalWardrobeItem,
  updateWardrobeItem,
  type WardrobeActionState,
} from "./actions";

function formatCategory(code: string): string {
  return code.charAt(0).toUpperCase() + code.slice(1);
}

function WardrobeItemCard({
  item,
  retailerName,
}: {
  item: WardrobeItem;
  retailerName: string;
}) {
  const initialState: WardrobeActionState = { fieldErrors: {} };
  const [updateState, updateAction, updatePending] = useActionState(
    updateWardrobeItem,
    initialState,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveWardrobeItem,
    initialState,
  );

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
            {formatCategory(item.categoryCode)} · {retailerName}
          </p>
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            {item.title}
          </h2>
          {item.brand ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              {item.brand}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-[var(--color-stone-600)]">
            {wardrobeOwnershipLabel(item.ownershipSource)} ·{" "}
            {wardrobeConditionLabel(item.state.conditionState)}
          </p>
        </div>
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- customer-provided external photo URL
          <img
            src={item.photoUrl}
            alt=""
            className="h-24 w-24 rounded-[var(--radius-sm)] object-cover"
          />
        ) : null}
      </div>

      {item.description ? (
        <p className="text-sm text-[var(--color-stone-600)]">
          {item.description}
        </p>
      ) : null}

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

      <form action={updateAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="itemId" value={item.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--color-stone-700)]">
            Condition
          </span>
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--color-stone-700)]">
            How often you wear it
          </span>
          <select
            name="wearFrequency"
            defaultValue={item.state.wearFrequency ?? ""}
            className="rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
          >
            <option value="">Not set</option>
            {WARDROBE_WEAR_FREQUENCIES.map((freq) => (
              <option key={freq} value={freq}>
                {freq.charAt(0).toUpperCase() + freq.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-[var(--color-stone-700)]">
            Fit notes (self-reported)
          </span>
          <textarea
            name="fitNotes"
            rows={2}
            defaultValue={item.state.fitNotes ?? ""}
            className="rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-[var(--color-stone-700)]">
            Care notes
          </span>
          <textarea
            name="careNotes"
            rows={2}
            defaultValue={item.state.careNotes ?? ""}
            className="rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={updatePending}>
            Save changes
          </Button>
        </div>
      </form>

      {archiveState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {archiveState.formError}
        </p>
      ) : null}

      <form action={archiveAction}>
        <input type="hidden" name="itemId" value={item.id} />
        <Button type="submit" variant="ghost" disabled={archivePending}>
          Remove from wardrobe
        </Button>
      </form>
    </Card>
  );
}

export function WardrobeHousePanel({
  retailerId,
  retailerName,
  items,
}: {
  retailerId: string;
  retailerName: string;
  items: readonly WardrobeItem[];
}) {
  const initialState: WardrobeActionState = { fieldErrors: {} };
  const [createState, createAction, createPending] = useActionState(
    createExternalWardrobeItem,
    initialState,
  );

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby={`wardrobe-${retailerId}`}
    >
      <div>
        <h2
          id={`wardrobe-${retailerId}`}
          className="text-xl font-medium text-[var(--color-stone-900)]"
        >
          {retailerName}
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Garments you own with this house — purchased here or added by you. Fit
          notes are self-reported and separate from official fitting records.
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            No wardrobe items yet. Add something you already own, or ask your
            advisor to link a purchase from this house.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <WardrobeItemCard item={item} retailerName={retailerName} />
            </li>
          ))}
        </ul>
      )}

      <Card className="flex flex-col gap-3">
        <h3 className="text-base font-medium text-[var(--color-stone-900)]">
          Add an external garment
        </h3>
        {createState.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {createState.formError}
          </p>
        ) : null}
        {createState.success ? (
          <p role="status" className="text-sm text-[var(--color-success-500)]">
            Garment added to your wardrobe.
          </p>
        ) : null}
        <form action={createAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="retailerId" value={retailerId} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--color-stone-700)]">
              Category
            </span>
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
            <span className="font-medium text-[var(--color-stone-700)]">
              Title
            </span>
            <input
              name="title"
              required
              maxLength={200}
              className="rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--color-stone-700)]">
              Brand
            </span>
            <input
              name="brand"
              maxLength={120}
              className="rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--color-stone-700)]">
              Condition
            </span>
            <select
              name="conditionState"
              defaultValue="good"
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
            <span className="font-medium text-[var(--color-stone-700)]">
              Description
            </span>
            <textarea
              name="description"
              rows={2}
              className="rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={createPending}>
              Add to wardrobe
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
