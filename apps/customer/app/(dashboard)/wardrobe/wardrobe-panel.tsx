"use client";

import {
  GARMENT_CATEGORIES,
  WARDROBE_CARE_STATES,
  WARDROBE_CONDITION_STATES,
  WARDROBE_FIT_PERCEPTIONS,
  WARDROBE_WEAR_FREQUENCIES,
  type FitFreshnessProjection,
  type WardrobeGuidanceItem,
  type WardrobeItem,
  type WardrobeOwnershipEvent,
  type WardrobeSelfReport,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import {
  addExternalWardrobeItem,
  retireWardrobeItem,
  type WardrobeActionState,
} from "./actions";
import { WardrobeItemLifecyclePanel } from "./wardrobe-lifecycle-panel";

function ownershipLabel(item: WardrobeItem): string {
  if (item.ownershipKind === "retailer_purchased") {
    return "Purchased here";
  }
  return "External";
}

function provenanceLabel(item: WardrobeItem): string {
  switch (item.provenanceSource) {
    case "order_line":
      return "Order line";
    case "catalogue_link":
      return "Catalogue link";
    case "customer_added":
      return "Added by you";
    case "advisor_added":
      return "Added by advisor";
  }
}

export function WardrobeHousePanel({
  retailerId,
  retailerSlug,
  retailerName,
  customerId,
  items,
  historyByItemId,
  lifecycleByItemId,
}: {
  retailerId: string;
  retailerSlug: string;
  retailerName: string;
  customerId: string;
  items: readonly WardrobeItem[];
  historyByItemId: Readonly<Record<string, readonly WardrobeOwnershipEvent[]>>;
  lifecycleByItemId: Readonly<
    Record<
      string,
      {
        guidance: readonly WardrobeGuidanceItem[];
        fitFreshness: FitFreshnessProjection;
        selfReports: readonly {
          report: WardrobeSelfReport;
          signedUrl?: string;
        }[];
        orderStatus?: string | null;
      }
    >
  >;
}) {
  const initialState: WardrobeActionState = { fieldErrors: {} };
  const [addState, addAction, addPending] = useActionState(
    addExternalWardrobeItem,
    initialState,
  );
  const [retireState, retireAction, retirePending] = useActionState(
    retireWardrobeItem,
    initialState,
  );

  const active = items.filter((item) => item.condition !== "retired");
  const retired = items.filter((item) => item.condition === "retired");

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Wardrobe — {retailerName}
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Pieces you own with this house. External garments stay private to this
          relationship; fit notes are self-reported and never become official
          measurements.
        </p>
      </div>

      {addState.formError || retireState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {addState.formError ?? retireState.formError}
        </p>
      ) : null}
      {addState.success ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          External garment added to your wardrobe.
        </p>
      ) : null}
      {retireState.success ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Garment marked retired.
        </p>
      ) : null}

      {items.length === 0 ? (
        <div
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-4 py-10 text-center"
          role="status"
        >
          <p className="text-sm font-medium text-[var(--color-stone-900)]">
            Your wardrobe is empty
          </p>
          <p className="mt-2 text-sm text-[var(--color-stone-500)]">
            Add a garment bought elsewhere, or ask your advisor to link a
            purchase from this house.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-stone-100)]">
          {active.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 py-4 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {item.brand ? `${item.brand} · ` : ""}
                    {item.displayName}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {item.categoryCode} · {ownershipLabel(item)} ·{" "}
                    {provenanceLabel(item)} · {item.condition}
                  </p>
                </div>
                {item.condition !== "retired" ? (
                  <form action={retireAction}>
                    <input type="hidden" name="retailerId" value={retailerId} />
                    <input
                      type="hidden"
                      name="wardrobeItemId"
                      value={item.id}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={retirePending}
                    >
                      Retire
                    </Button>
                  </form>
                ) : null}
              </div>
              {item.description ? (
                <p className="text-sm text-[var(--color-stone-600)]">
                  {item.description}
                </p>
              ) : null}
              <p className="text-xs text-[var(--color-stone-500)]">
                Care {item.careState}
                {item.wearFrequency ? ` · Wear ${item.wearFrequency}` : ""}
                {` · Fit ${item.fitPerception.replaceAll("_", " ")}`}
              </p>
              {item.fitNotes ? (
                <p className="text-xs text-[var(--color-stone-600)]">
                  Fit note: {item.fitNotes}
                </p>
              ) : null}
              {(historyByItemId[item.id] ?? []).length > 0 ? (
                <details className="text-xs text-[var(--color-stone-500)]">
                  <summary className="cursor-pointer">
                    Ownership history
                  </summary>
                  <ul className="mt-2 space-y-1 pl-3">
                    {(historyByItemId[item.id] ?? []).map((event) => (
                      <li key={event.id}>
                        {event.eventKind.replaceAll("_", " ")} ·{" "}
                        {event.ownershipKind.replaceAll("_", " ")} ·{" "}
                        {new Date(event.occurredAt).toLocaleDateString()}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {(lifecycleByItemId[item.id] ?? null) ? (
                <WardrobeItemLifecyclePanel
                  retailerId={retailerId}
                  retailerSlug={retailerSlug}
                  item={item}
                  guidance={lifecycleByItemId[item.id]!.guidance}
                  fitFreshness={lifecycleByItemId[item.id]!.fitFreshness}
                  selfReports={lifecycleByItemId[item.id]!.selfReports}
                  {...(lifecycleByItemId[item.id]!.orderStatus !== undefined
                    ? {
                        orderStatus: lifecycleByItemId[item.id]!.orderStatus,
                      }
                    : {})}
                />
              ) : null}
            </li>
          ))}
          {retired.length > 0 ? (
            <li className="pt-4 text-xs text-[var(--color-stone-500)]">
              {retired.length} retired piece
              {retired.length === 1 ? "" : "s"} kept for history.
            </li>
          ) : null}
        </ul>
      )}

      <form
        action={addAction}
        className="flex flex-col gap-3 border-t border-[var(--color-stone-100)] pt-5"
        aria-label={`Add external garment for ${retailerName}`}
      >
        <input type="hidden" name="retailerId" value={retailerId} />
        <input type="hidden" name="customerId" value={customerId} />
        <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
          Add an external garment
        </h3>
        <p className="text-xs text-[var(--color-stone-500)]">
          Descriptions stay with this house. Metadata proposals are reviewable
          by your advisor and never invent a catalogue product.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span>Name</span>
          <input
            name="displayName"
            required
            maxLength={200}
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
            aria-invalid={!!addState.fieldErrors.displayName}
          />
          {addState.fieldErrors.displayName ? (
            <span className="text-xs text-[var(--color-danger-500)]">
              {addState.fieldErrors.displayName}
            </span>
          ) : null}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Category</span>
            <select
              name="categoryCode"
              required
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
              defaultValue="jacket"
            >
              {GARMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Brand</span>
            <input
              name="brand"
              maxLength={120}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span>Description</span>
          <textarea
            name="description"
            maxLength={2000}
            rows={2}
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Condition</span>
            <select
              name="condition"
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
              defaultValue="good"
            >
              {WARDROBE_CONDITION_STATES.filter(
                (state) => state !== "retired",
              ).map((state) => (
                <option key={state} value={state}>
                  {state.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Wear</span>
            <select
              name="wearFrequency"
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
              defaultValue=""
            >
              <option value="">Not set</option>
              {WARDROBE_WEAR_FREQUENCIES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Care</span>
            <select
              name="careState"
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
              defaultValue="current"
            >
              {WARDROBE_CARE_STATES.map((state) => (
                <option key={state} value={state}>
                  {state.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Perceived fit</span>
            <select
              name="fitPerception"
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
              defaultValue="unknown"
            >
              {WARDROBE_FIT_PERCEPTIONS.map((state) => (
                <option key={state} value={state}>
                  {state.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span>Fit notes (self-reported)</span>
          <textarea
            name="fitNotes"
            maxLength={2000}
            rows={2}
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>
        <Button type="submit" disabled={addPending}>
          {addPending ? "Adding…" : "Add to wardrobe"}
        </Button>
      </form>
    </Card>
  );
}
