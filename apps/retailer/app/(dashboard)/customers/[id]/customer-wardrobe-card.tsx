"use client";

import {
  GARMENT_CATEGORIES,
  WARDROBE_CONDITION_STATES,
  type WardrobeItem,
  type WardrobeOwnershipEvent,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState } from "react";

import {
  addAdvisorExternalWardrobeItem,
  addCatalogueWardrobeItem,
  type RetailerWardrobeActionState,
} from "./wardrobe-actions";

function ownershipLabel(item: WardrobeItem): string {
  return item.ownershipKind === "retailer_purchased"
    ? "Purchased here"
    : "External";
}

export function CustomerWardrobeCard({
  customerId,
  items,
  historyByItemId,
  catalogueProducts,
  canManage,
}: {
  customerId: string;
  items: readonly WardrobeItem[];
  historyByItemId: Readonly<Record<string, readonly WardrobeOwnershipEvent[]>>;
  catalogueProducts: readonly { id: string; name: string }[];
  canManage: boolean;
}) {
  const initialState: RetailerWardrobeActionState = { fieldErrors: {} };
  const [externalState, externalAction, externalPending] = useActionState(
    addAdvisorExternalWardrobeItem,
    initialState,
  );
  const [catalogueState, catalogueAction, cataloguePending] = useActionState(
    addCatalogueWardrobeItem,
    initialState,
  );

  return (
    <Card id="wardrobe" className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          Wardrobe
        </h2>
        <p className="text-sm text-[var(--color-stone-500)]">
          Owned pieces for this relationship. Distinct from physical garments
          used for official fittings. External metadata stays reviewable and
          never clones the catalogue.
        </p>
      </div>

      {externalState.formError || catalogueState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {externalState.formError ?? catalogueState.formError}
        </p>
      ) : null}
      {externalState.success || catalogueState.success ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Wardrobe item saved.
        </p>
      ) : null}

      {items.length === 0 ? (
        <div
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-4 py-8 text-center"
          role="status"
        >
          <p className="text-sm font-medium text-[var(--color-stone-900)]">
            No wardrobe items yet
          </p>
          <p className="mt-2 text-sm text-[var(--color-stone-500)]">
            Link a house purchase or record an external garment the client
            already owns.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-stone-100)]">
          {items.map((item) => (
            <li key={item.id} className="py-3">
              <p className="text-sm font-medium text-[var(--color-stone-900)]">
                {item.brand ? `${item.brand} · ` : ""}
                {item.displayName}
              </p>
              <p className="text-xs text-[var(--color-stone-500)]">
                {item.categoryCode} · {ownershipLabel(item)} ·{" "}
                {item.provenanceSource.replaceAll("_", " ")} · {item.condition}{" "}
                · care {item.careState} · fit{" "}
                {item.fitPerception.replaceAll("_", " ")}
              </p>
              {item.fitNotes ? (
                <p className="mt-1 text-xs text-[var(--color-stone-600)]">
                  Self-reported fit: {item.fitNotes}
                </p>
              ) : null}
              {(historyByItemId[item.id] ?? []).length > 0 ? (
                <details className="mt-1 text-xs text-[var(--color-stone-500)]">
                  <summary className="cursor-pointer">
                    Ownership history
                  </summary>
                  <ul className="mt-1 space-y-1 pl-3">
                    {(historyByItemId[item.id] ?? []).map((event) => (
                      <li key={event.id}>
                        {event.eventKind.replaceAll("_", " ")} ·{" "}
                        {new Date(event.occurredAt).toLocaleDateString()}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="grid gap-5 border-t border-[var(--color-stone-100)] pt-4 lg:grid-cols-2">
          <form
            action={catalogueAction}
            className="flex flex-col gap-3"
            aria-label="Link catalogue product to wardrobe"
          >
            <input type="hidden" name="customerId" value={customerId} />
            <h3 className="text-sm font-medium">Link house purchase</h3>
            <label className="flex flex-col gap-1 text-sm">
              <span>Catalogue product</span>
              <select
                name="productId"
                required
                className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Select product
                </option>
                {catalogueProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              {catalogueState.fieldErrors.productId ? (
                <span className="text-xs text-[var(--color-danger-500)]">
                  {catalogueState.fieldErrors.productId}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Category</span>
              <select
                name="categoryCode"
                className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
                defaultValue="other"
              >
                {GARMENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" size="sm" disabled={cataloguePending}>
              {cataloguePending ? "Linking…" : "Add purchased item"}
            </Button>
          </form>

          <form
            action={externalAction}
            className="flex flex-col gap-3"
            aria-label="Add external wardrobe garment"
          >
            <input type="hidden" name="customerId" value={customerId} />
            <h3 className="text-sm font-medium">Add external garment</h3>
            <label className="flex flex-col gap-1 text-sm">
              <span>Name</span>
              <input
                name="displayName"
                required
                maxLength={200}
                className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
              />
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
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span>Brand</span>
              <input
                name="brand"
                maxLength={120}
                className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Description</span>
              <textarea
                name="description"
                maxLength={2000}
                rows={2}
                className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
              />
            </label>
            <Button type="submit" size="sm" disabled={externalPending}>
              {externalPending ? "Adding…" : "Add external item"}
            </Button>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
