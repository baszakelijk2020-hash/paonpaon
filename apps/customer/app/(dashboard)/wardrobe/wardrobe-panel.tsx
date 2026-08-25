"use client";

import {
  WARDROBE_SERVICE_REQUEST_KIND_LABELS,
  WARDROBE_SERVICE_REQUEST_KINDS,
  type CompleteTheLookSuggestion,
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
  requestWardrobeItemService,
  retireWardrobeItem,
  type WardrobeActionState,
  type WardrobeServiceRequestState,
} from "./actions";
import { SuggestedLookTile } from "./suggested-look-tile";

const LIFECYCLE_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
  year: "numeric",
});

function formatLifecycleDate(value: string): string {
  return LIFECYCLE_DATE_FORMATTER.format(new Date(value));
}

function ownershipLabel(item: WardrobeItem): string {
  return item.ownershipKind === "retailer_purchased"
    ? "In your wardrobe"
    : "Wardrobe item";
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
  completeTheLookSuggestions,
  retireAction,
  retirePending,
  serviceRequestAction,
  serviceRequestPending,
}: {
  retailerId: string;
  item: WardrobeItem;
  history: readonly WardrobeOwnershipEvent[];
  completeTheLookSuggestions: readonly CompleteTheLookSuggestion[];
  retireAction: (payload: FormData) => void;
  retirePending: boolean;
  serviceRequestAction: (payload: FormData) => void;
  serviceRequestPending: boolean;
}) {
  return (
    <article className="flex w-[min(78vw,19rem)] shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-stone-200)] bg-white sm:w-[19rem]">
      {item.identifyingPhotoUrl ? (
        <Image
          src={item.identifyingPhotoUrl}
          alt={item.displayName}
          width={576}
          height={432}
          unoptimized
          className="aspect-[4/5] w-full bg-[var(--color-stone-100)] object-cover"
        />
      ) : (
        <div
          className="flex aspect-[4/5] items-end bg-gradient-to-br from-[var(--color-stone-100)] to-[var(--color-stone-200)] p-4"
          aria-hidden="true"
        >
          <span className="font-display text-2xl text-[var(--color-stone-500)]">
            {item.categoryCode.replaceAll("_", " ")}
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div>
          <p className="line-clamp-2 text-sm font-medium leading-5 text-[var(--color-stone-900)]">
            {item.brand ? `${item.brand} · ` : ""}
            {item.displayName}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[var(--color-stone-500)]">
            {item.categoryCode.replaceAll("_", " ")} · {ownershipLabel(item)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 text-[10px]">
          <span className="rounded-full bg-[var(--color-stone-100)] px-2 py-1 text-[var(--color-stone-700)]">
            Care · {item.careState.replaceAll("_", " ")}
          </span>
          <span className="rounded-full bg-[var(--color-stone-100)] px-2 py-1 text-[var(--color-stone-700)]">
            {item.condition.replaceAll("_", " ")}
          </span>
        </div>
        <details className="group border-t border-[var(--color-stone-200)] pt-3 text-xs text-[var(--color-stone-500)]">
          <summary className="cursor-pointer list-none font-medium text-[var(--color-stone-700)] marker:hidden">
            <span className="flex items-center justify-between">
              Garment details
              <span
                aria-hidden
                className="text-base leading-none transition-transform group-open:rotate-45"
              >
                +
              </span>
            </span>
          </summary>
          <div className="mt-3 space-y-3">
            <p>
              Fit · {item.fitPerception.replaceAll("_", " ")} · Wear ·{" "}
              {item.wearFrequency ?? "Not set"}
            </p>
            <p>Source · {provenanceLabel(item)}</p>
            {item.description ? <p>{item.description}</p> : null}
            {item.fitNotes ? <p>Fit note · {item.fitNotes}</p> : null}
            {history.length > 0 ? (
              <ul className="space-y-1">
                {history.map((event) => (
                  <li key={event.id}>
                    {event.eventKind.replaceAll("_", " ")} ·{" "}
                    {formatLifecycleDate(event.occurredAt)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>
        {completeTheLookSuggestions.length > 0 ? (
          <details
            className="group border-t border-[var(--color-stone-200)] pt-3 text-xs text-[var(--color-stone-500)]"
            data-item-complete-the-look
          >
            <summary className="cursor-pointer list-none font-medium text-[var(--color-stone-700)] marker:hidden">
              <span className="flex items-center justify-between">
                Pairs well with{" "}
                <span
                  aria-hidden
                  className="text-base leading-none transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </span>
            </summary>
            <ul className="-mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
              {completeTheLookSuggestions.map((suggestion) => (
                <SuggestedLookTile
                  key={suggestion.productId}
                  retailerId={retailerId}
                  suggestion={suggestion}
                />
              ))}
            </ul>
          </details>
        ) : null}
        <details className="group mt-auto border-t border-[var(--color-stone-200)] pt-3 text-xs text-[var(--color-stone-500)]">
          <summary className="cursor-pointer list-none font-medium text-[var(--color-stone-700)] marker:hidden">
            <span className="flex items-center justify-between">
              Manage garment{" "}
              <span
                aria-hidden
                className="text-base leading-none transition-transform group-open:rotate-45"
              >
                +
              </span>
            </span>
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
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
        </details>
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
      <div className="flex aspect-[4/5] items-end p-4" aria-hidden="true">
        <span className="rounded-full border border-[var(--color-stone-200)] bg-white/70 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
          On your roadmap
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="text-sm font-medium text-[var(--color-stone-800)]">
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
  completeTheLookByCategory,
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
  completeTheLookByCategory: Readonly<
    Partial<Record<GarmentCategoryCode, readonly CompleteTheLookSuggestion[]>>
  >;
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
              completeTheLookSuggestions={
                completeTheLookByCategory[item.categoryCode] ?? []
              }
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
      ) : null}
    </section>
  );
}

export function WardrobeHousePanel({
  retailerId,
  retailerName,
  items,
  historyByItemId,
  roadmaps,
  completeTheLookByCategory,
}: {
  retailerId: string;
  retailerName: string;
  items: readonly WardrobeItem[];
  historyByItemId: Readonly<Record<string, readonly WardrobeOwnershipEvent[]>>;
  roadmaps: readonly WardrobeRoadmap[];
  completeTheLookByCategory: Readonly<
    Partial<Record<GarmentCategoryCode, readonly CompleteTheLookSuggestion[]>>
  >;
}) {
  const initialState: WardrobeActionState = { fieldErrors: {} };
  const initialServiceRequestState: WardrobeServiceRequestState = {
    fieldErrors: {},
  };
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
          Your garments and advisor selections, organised by category. Fit notes
          remain self-reported and never become official measurements.
        </p>
      </div>

      {retireState.formError || serviceRequestState.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {retireState.formError ?? serviceRequestState.formError}
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
        {sectionsWithItems
          .filter(
            ({ items: sectionItems, gaps }) =>
              sectionItems.length > 0 || gaps.length > 0,
          )
          .map(({ section, items: sectionItems, gaps }) => (
            <WardrobeCarousel
              key={section.id}
              id={section.id}
              label={section.label}
              items={sectionItems}
              gaps={gaps}
              retailerId={retailerId}
              historyByItemId={historyByItemId}
              completeTheLookByCategory={completeTheLookByCategory}
              retireAction={retireAction}
              retirePending={retirePending}
              serviceRequestAction={serviceRequestAction}
              serviceRequestPending={serviceRequestPending}
            />
          ))}
        {active.length === 0 ? (
          <p role="status" className="text-sm text-[var(--color-stone-500)]">
            Your purchased garments will appear here after they are linked to
            your account.
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
    </Card>
  );
}
