"use client";

import {
  GARMENT_CATEGORIES,
  WARDROBE_CARE_STATES,
  WARDROBE_CONDITION_STATES,
  WARDROBE_FIT_PERCEPTIONS,
  WARDROBE_WEAR_FREQUENCIES,
  type GarmentCategoryCode,
  type WardrobeItem,
  type WardrobeOwnershipEvent,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  addExternalWardrobeItem,
  retireWardrobeItem,
  type WardrobeActionState,
} from "./actions";

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

const WARDROBE_SECTIONS = [
  {
    id: "suits",
    label: "Suits",
    categories: ["suit", "trousers", "waistcoat", "formalwear"],
  },
  {
    id: "jackets",
    label: "Jackets",
    categories: ["jacket", "overcoat", "coat", "leather"],
  },
  { id: "shirts", label: "Shirts", categories: ["shirt"] },
  { id: "knitwear", label: "Knitwear", categories: ["knitwear"] },
  { id: "shoes", label: "Shoes", categories: ["shoes"] },
  {
    id: "accessories",
    label: "Accessories",
    categories: ["accessories", "pocket_square", "denim", "other"],
  },
] as const satisfies readonly {
  readonly id: string;
  readonly label: string;
  readonly categories: readonly GarmentCategoryCode[];
}[];

function WardrobeItemCard({
  retailerId,
  item,
  history,
  retireAction,
  retirePending,
}: {
  retailerId: string;
  item: WardrobeItem;
  history: readonly WardrobeOwnershipEvent[];
  retireAction: (payload: FormData) => void;
  retirePending: boolean;
}) {
  return (
    <article className="flex w-[min(78vw,18rem)] shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-stone-200)] bg-white sm:w-72">
      {item.identifyingPhotoUrl ? (
        <Image
          src={item.identifyingPhotoUrl}
          alt={item.displayName}
          width={576}
          height={432}
          unoptimized
          className="aspect-[4/3] w-full bg-[var(--color-stone-100)] object-cover"
        />
      ) : (
        <div
          className="flex aspect-[4/3] items-end bg-gradient-to-br from-[var(--color-stone-100)] to-[var(--color-stone-200)] p-4"
          aria-hidden="true"
        >
          <span className="font-display text-2xl text-[var(--color-stone-500)]">
            {item.categoryCode.replaceAll("_", " ")}
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-sm font-medium text-[var(--color-stone-900)]">
            {item.brand ? `${item.brand} · ` : ""}
            {item.displayName}
          </p>
          <p className="mt-1 text-xs text-[var(--color-stone-500)]">
            {item.categoryCode.replaceAll("_", " ")} · {ownershipLabel(item)} ·{" "}
            {provenanceLabel(item)}
          </p>
        </div>
        {item.description ? (
          <p className="line-clamp-3 text-sm text-[var(--color-stone-600)]">
            {item.description}
          </p>
        ) : null}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <dt className="text-[var(--color-stone-500)]">Care</dt>
            <dd className="text-[var(--color-stone-700)]">
              {item.careState.replaceAll("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-stone-500)]">Fit</dt>
            <dd className="text-[var(--color-stone-700)]">
              {item.fitPerception.replaceAll("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-stone-500)]">Condition</dt>
            <dd className="text-[var(--color-stone-700)]">
              {item.condition.replaceAll("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-stone-500)]">Wear</dt>
            <dd className="text-[var(--color-stone-700)]">
              {item.wearFrequency ?? "Not set"}
            </dd>
          </div>
        </dl>
        {item.fitNotes ? (
          <p className="text-xs text-[var(--color-stone-600)]">
            Fit note: {item.fitNotes}
          </p>
        ) : null}
        {history.length > 0 ? (
          <details className="text-xs text-[var(--color-stone-500)]">
            <summary className="cursor-pointer">Ownership history</summary>
            <ul className="mt-2 space-y-1">
              {history.map((event) => (
                <li key={event.id}>
                  {event.eventKind.replaceAll("_", " ")} ·{" "}
                  {event.ownershipKind.replaceAll("_", " ")} ·{" "}
                  {new Date(event.occurredAt).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <form action={retireAction} className="mt-auto pt-1">
          <input type="hidden" name="retailerId" value={retailerId} />
          <input type="hidden" name="wardrobeItemId" value={item.id} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={retirePending}
          >
            Retire
          </Button>
        </form>
      </div>
    </article>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** No `downloaded_pages` fragment matches the founder's "tactile stacked
 * rail" description (checked directly: only a decorative, differently-
 * categorised homepage image carousel exists, not an interactive personal-
 * wardrobe rail) — see FOUNDER_TOOL_BLUEPRINTS.md FT-12. Built against the
 * blueprint's own physical description (opening/closing, layered depth,
 * horizontal movement) with PAON primitives rather than guessed pixels. */
function WardrobeRail({
  id,
  label,
  items,
  retailerId,
  historyByItemId,
  retireAction,
  retirePending,
  open,
  onToggle,
  onKeyNav,
  headerRef,
}: {
  id: string;
  label: string;
  items: readonly WardrobeItem[];
  retailerId: string;
  historyByItemId: Readonly<Record<string, readonly WardrobeOwnershipEvent[]>>;
  retireAction: (payload: FormData) => void;
  retirePending: boolean;
  open: boolean;
  onToggle: () => void;
  onKeyNav: (direction: "next" | "previous") => void;
  headerRef: (el: HTMLButtonElement | null) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const peek = items.slice(0, 3);
  const headerId = `wardrobe-rail-${retailerId}-${id}`;
  const panelId = `wardrobe-rail-panel-${retailerId}-${id}`;

  return (
    <section aria-labelledby={headerId}>
      <button
        ref={headerRef}
        id={headerId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            onKeyNav("next");
          } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            onKeyNav("previous");
          }
        }}
        className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] py-2 text-left"
      >
        <span className="flex items-center gap-4">
          <span className="relative h-14 w-16 shrink-0" aria-hidden="true">
            {peek.length === 0 ? (
              <span className="absolute inset-0 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-stone-300)]" />
            ) : (
              peek.map((item, index) => (
                <span
                  key={item.id}
                  className="absolute inset-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-stone-200)] bg-[var(--color-stone-100)] shadow-sm transition-transform motion-reduce:transition-none"
                  style={{
                    zIndex: peek.length - index,
                    transform: reducedMotion
                      ? undefined
                      : `translateX(${index * 8}px) rotate(${(index - (peek.length - 1) / 2) * 5}deg)`,
                  }}
                >
                  {item.identifyingPhotoUrl ? (
                    <Image
                      src={item.identifyingPhotoUrl}
                      alt=""
                      width={64}
                      height={56}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
              ))
            )}
          </span>
          <span>
            <span className="font-display block text-xl text-[var(--color-stone-900)]">
              {label}
            </span>
            <span className="text-xs text-[var(--color-stone-500)]">
              {items.length} piece{items.length === 1 ? "" : "s"}
            </span>
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`text-[var(--color-stone-400)] transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className="grid transition-[grid-template-rows] duration-300 ease-[var(--ease-out-quiet)] motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          {items.length > 0 ? (
            <div
              className="-mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2"
              style={{ scrollbarWidth: "thin" }}
            >
              {items.map((item) => (
                <WardrobeItemCard
                  key={item.id}
                  retailerId={retailerId}
                  item={item}
                  history={historyByItemId[item.id] ?? []}
                  retireAction={retireAction}
                  retirePending={retirePending}
                />
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-4 py-7 text-center">
              <p className="text-sm text-[var(--color-stone-500)]">
                No {label.toLowerCase()} in this wardrobe yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function WardrobeHousePanel({
  retailerId,
  retailerName,
  customerId,
  items,
  historyByItemId,
}: {
  retailerId: string;
  retailerName: string;
  customerId: string;
  items: readonly WardrobeItem[];
  historyByItemId: Readonly<Record<string, readonly WardrobeOwnershipEvent[]>>;
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
  const sectionsWithItems = WARDROBE_SECTIONS.map((section) => ({
    section,
    items: active.filter((item) =>
      (section.categories as readonly GarmentCategoryCode[]).includes(
        item.categoryCode,
      ),
    ),
  }));
  const firstNonEmptyId =
    sectionsWithItems.find(({ items: sectionItems }) => sectionItems.length > 0)
      ?.section.id ?? sectionsWithItems[0]?.section.id;
  const [openRailId, setOpenRailId] = useState<string | undefined>(
    firstNonEmptyId,
  );
  const railHeaderRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusRail(direction: "next" | "previous", fromId: string) {
    const ids: string[] = sectionsWithItems.map(({ section }) => section.id);
    const index = ids.indexOf(fromId);
    const nextIndex =
      direction === "next"
        ? (index + 1) % ids.length
        : (index - 1 + ids.length) % ids.length;
    const nextId = ids[nextIndex];
    if (nextId) railHeaderRefs.current[nextId]?.focus();
  }

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

      <div className="flex flex-col gap-3" role="presentation">
        {sectionsWithItems.map(({ section, items: sectionItems }) => (
          <WardrobeRail
            key={section.id}
            id={section.id}
            label={section.label}
            items={sectionItems}
            retailerId={retailerId}
            historyByItemId={historyByItemId}
            retireAction={retireAction}
            retirePending={retirePending}
            open={openRailId === section.id}
            onToggle={() =>
              setOpenRailId((current) =>
                current === section.id ? undefined : section.id,
              )
            }
            onKeyNav={(direction) => focusRail(direction, section.id)}
            headerRef={(el) => {
              railHeaderRefs.current[section.id] = el;
            }}
          />
        ))}
        {active.length === 0 ? (
          <p role="status" className="text-sm text-[var(--color-stone-500)]">
            Add a garment bought elsewhere, or ask your advisor to link a
            purchase from this house.
          </p>
        ) : null}
        {retired.length > 0 ? (
          <p className="text-xs text-[var(--color-stone-500)]">
            {retired.length} retired piece
            {retired.length === 1 ? "" : "s"} kept for ownership and service
            history.
          </p>
        ) : null}
      </div>

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
