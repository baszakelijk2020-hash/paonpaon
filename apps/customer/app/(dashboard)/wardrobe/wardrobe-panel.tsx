"use client";

import {
  GARMENT_CATEGORIES,
  WARDROBE_CARE_STATES,
  WARDROBE_CONDITION_STATES,
  WARDROBE_FIT_PERCEPTIONS,
  WARDROBE_SERVICE_REQUEST_KIND_LABELS,
  WARDROBE_SERVICE_REQUEST_KINDS,
  WARDROBE_WEAR_FREQUENCIES,
  type GarmentCategoryCode,
  type WardrobeItem,
  type WardrobeOwnershipEvent,
  type WardrobeRoadmap,
  type WardrobeRoadmapGap,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";

import {
  addExternalWardrobeItem,
  requestWardrobeItemService,
  retireWardrobeItem,
  type WardrobeActionState,
  type WardrobeServiceRequestState,
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
  serviceRequestAction,
  serviceRequestPending,
}: {
  retailerId: string;
  item: WardrobeItem;
  history: readonly WardrobeOwnershipEvent[];
  retireAction: (payload: FormData) => void;
  retirePending: boolean;
  serviceRequestAction: (payload: FormData) => void;
  serviceRequestPending: boolean;
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
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {WARDROBE_SERVICE_REQUEST_KINDS.map((kind) => (
            <form key={kind} action={serviceRequestAction}>
              <input type="hidden" name="retailerId" value={retailerId} />
              <input type="hidden" name="wardrobeItemId" value={item.id} />
              <input type="hidden" name="kind" value={kind} />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={serviceRequestPending}
              >
                {WARDROBE_SERVICE_REQUEST_KIND_LABELS[kind]}
              </Button>
            </form>
          ))}
          <form action={retireAction}>
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
      </div>
    </article>
  );
}

/** An approved roadmap gap not yet filled by a real purchase or wardrobe
 * item — "the ideal wardrobe roadmap" the customer's advisor already
 * approved with them, surfaced in the same carousel as what they own
 * rather than buried on a separate roadmap page. A filled gap already has
 * an owned card representing it, so it is excluded here to avoid showing
 * the same piece twice. */
function AspirationalGapCard({ gap }: { gap: WardrobeRoadmapGap }) {
  return (
    <article className="flex w-[min(78vw,18rem)] shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] bg-[var(--color-stone-50)] sm:w-72">
      <div className="flex aspect-[4/3] items-end p-4" aria-hidden="true">
        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-stone-600)]">
          On your roadmap
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-sm font-medium text-[var(--color-stone-900)]">
          {gap.title}
        </p>
        {gap.description ? (
          <p className="line-clamp-3 text-sm text-[var(--color-stone-600)]">
            {gap.description}
          </p>
        ) : null}
        {gap.howPurchaseFillsGap ? (
          <p className="text-xs text-[var(--color-stone-500)]">
            Why: {gap.howPurchaseFillsGap}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** Always-visible horizontal carousel, one per garment category, stacked
 * top to bottom — no click-to-expand: browsing the wardrobe means
 * scrolling within each rail, not opening one section at a time. No
 * `downloaded_pages` fragment matches a personal-wardrobe carousel
 * (checked directly: only a decorative, differently-categorised homepage
 * image carousel exists — see FOUNDER_TOOL_BLUEPRINTS.md FT-12), so this
 * is built with PAON primitives against the founder's own physical
 * description (layered depth, horizontal movement) rather than guessed
 * pixels. Aspirational pieces from an approved roadmap gap appear at the
 * end of the same strip, visually distinct (dashed border), so the
 * customer's advisor-approved "ideal wardrobe" lives in the one place they
 * already browse what they own — not a separate page. */
function WardrobeCarousel({
  id,
  label,
  items,
  gaps,
  retailerId,
  historyByItemId,
  retireAction,
  retirePending,
  serviceRequestAction,
  serviceRequestPending,
}: {
  id: string;
  label: string;
  items: readonly WardrobeItem[];
  gaps: readonly WardrobeRoadmapGap[];
  retailerId: string;
  historyByItemId: Readonly<Record<string, readonly WardrobeOwnershipEvent[]>>;
  retireAction: (payload: FormData) => void;
  retirePending: boolean;
  serviceRequestAction: (payload: FormData) => void;
  serviceRequestPending: boolean;
}) {
  const headerId = `wardrobe-carousel-${retailerId}-${id}`;

  return (
    <section aria-labelledby={headerId}>
      <div className="flex items-baseline justify-between gap-3 py-2">
        <h3
          id={headerId}
          className="font-display text-xl text-[var(--color-stone-900)]"
        >
          {label}
        </h3>
        <span className="text-xs text-[var(--color-stone-500)]">
          {items.length} piece{items.length === 1 ? "" : "s"}
          {gaps.length > 0 ? ` · ${gaps.length} on the roadmap` : ""}
        </span>
      </div>
      {items.length > 0 || gaps.length > 0 ? (
        <div
          className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2"
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
              serviceRequestAction={serviceRequestAction}
              serviceRequestPending={serviceRequestPending}
            />
          ))}
          {gaps.map((gap) => (
            <AspirationalGapCard key={gap.id} gap={gap} />
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-4 py-7 text-center">
          <p className="text-sm text-[var(--color-stone-500)]">
            No {label.toLowerCase()} in this wardrobe yet.
          </p>
        </div>
      )}
    </section>
  );
}

export function WardrobeHousePanel({
  retailerId,
  retailerName,
  customerId,
  items,
  historyByItemId,
  roadmaps,
}: {
  retailerId: string;
  retailerName: string;
  customerId: string;
  items: readonly WardrobeItem[];
  historyByItemId: Readonly<Record<string, readonly WardrobeOwnershipEvent[]>>;
  roadmaps: readonly WardrobeRoadmap[];
}) {
  const initialState: WardrobeActionState = { fieldErrors: {} };
  const initialServiceRequestState: WardrobeServiceRequestState = {
    fieldErrors: {},
  };
  const [addState, addAction, addPending] = useActionState(
    addExternalWardrobeItem,
    initialState,
  );
  const [retireState, retireAction, retirePending] = useActionState(
    retireWardrobeItem,
    initialState,
  );
  const [serviceRequestState, serviceRequestAction, serviceRequestPending] =
    useActionState(requestWardrobeItemService, initialServiceRequestState);

  const active = items.filter((item) => item.condition !== "retired");
  const retired = items.filter((item) => item.condition === "retired");
  const openGaps = roadmaps
    .filter((roadmap) => roadmap.status === "approved")
    .flatMap((roadmap) => roadmap.gaps)
    .filter((gap) => !gap.filledByProductId && !gap.filledByWardrobeItemId);
  const sectionsWithItems = WARDROBE_SECTIONS.map((section) => ({
    section,
    items: active.filter((item) =>
      (section.categories as readonly GarmentCategoryCode[]).includes(
        item.categoryCode,
      ),
    ),
    gaps: openGaps.filter(
      (gap) =>
        gap.categoryCode &&
        (section.categories as readonly GarmentCategoryCode[]).includes(
          gap.categoryCode,
        ),
    ),
  }));

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

      {addState.formError ||
      retireState.formError ||
      serviceRequestState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {addState.formError ??
            retireState.formError ??
            serviceRequestState.formError}
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
      {serviceRequestState.success ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Request sent to your advisor.{" "}
          {serviceRequestState.conversationId ? (
            <Link
              className="underline"
              href={`/messages/${serviceRequestState.conversationId}`}
            >
              View in Messages
            </Link>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-col gap-3" role="presentation">
        {sectionsWithItems.map(({ section, items: sectionItems, gaps }) => (
          <WardrobeCarousel
            key={section.id}
            id={section.id}
            label={section.label}
            items={sectionItems}
            gaps={gaps}
            retailerId={retailerId}
            historyByItemId={historyByItemId}
            retireAction={retireAction}
            retirePending={retirePending}
            serviceRequestAction={serviceRequestAction}
            serviceRequestPending={serviceRequestPending}
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
