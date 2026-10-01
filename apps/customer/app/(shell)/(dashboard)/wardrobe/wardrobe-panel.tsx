"use client";

import {
  WARDROBE_SERVICE_REQUEST_KIND_LABELS,
  type CompleteTheLookSuggestion,
  type GarmentCategoryCode,
  type WardrobeItem,
  type WardrobeOwnershipEvent,
  type WardrobeRoadmapGap,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import Link from "next/link";
import { useActionState, useState } from "react";

import { StaggerReveal } from "../stagger-reveal";

import {
  requestWardrobeItemReorderViaAdvisor,
  requestWardrobeItemService,
  retireWardrobeItem,
  type WardrobeActionState,
  type WardrobeServiceRequestState,
} from "./actions";
import {
  askAdvisorAboutWardrobeItem,
  type AdvisorAskState,
} from "./ask-advisor-actions";
import {
  submitWardrobeSelfScan,
  type LifecycleActionState,
} from "./lifecycle-actions";
import {
  decideWardrobeRoadmap,
  removeAdvisorSelectionFromPlan,
  type CustomerRoadmapActionState,
} from "./roadmap-actions";
import { SuggestedLookTile } from "./suggested-look-tile";

/** Exactly eight rails, in the contract's exact order. Every one of the 15
 * `GarmentCategoryCode` values maps to exactly one rail. */
export const WARDROBE_RAILS = [
  {
    id: "suits",
    label: "Suits",
    categories: ["suit", "waistcoat", "formalwear"],
  },
  { id: "jackets", label: "Jackets", categories: ["jacket", "leather"] },
  { id: "trousers", label: "Trousers", categories: ["trousers", "denim"] },
  { id: "shirts", label: "Shirts", categories: ["shirt"] },
  { id: "outerwear", label: "Outerwear", categories: ["overcoat", "coat"] },
  { id: "knitwear", label: "Knitwear", categories: ["knitwear"] },
  { id: "shoes", label: "Shoes", categories: ["shoes"] },
  {
    id: "accessories",
    label: "Accessories",
    categories: ["accessories", "pocket_square", "other"],
  },
] as const satisfies readonly {
  readonly id: string;
  readonly label: string;
  readonly categories: readonly GarmentCategoryCode[];
}[];

export interface OwnedCardModel {
  readonly item: WardrobeItem;
  readonly history: readonly WardrobeOwnershipEvent[];
  readonly completeTheLookSuggestions: readonly CompleteTheLookSuggestion[];
  readonly purchasedOnLabel: string;
  /** Real `/r/{retailerSlug}/products/{productSlug}` route for this item's
   * linked, still-existing product — resolved server-side. Absent when the
   * item has no product link or that product no longer exists; "The size
   * is perfect" then never renders a broken destination and the real
   * "Ask your advisor to reorder" action is offered instead. */
  readonly productDetailHref?: string;
}

export interface AdvisorSelectionAlternative {
  readonly productId: string;
  readonly productSlug: string;
  readonly displayName: string;
  readonly primaryImageUrl?: string;
}

export interface AdvisorSelectionProductLink {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly primaryImageUrl?: string;
}

export interface PendingRoadmapSummary {
  readonly id: string;
  readonly title: string;
}

type DeckScreen =
  | { kind: "menu" }
  | { kind: "complete-the-look" }
  | { kind: "order-again" }
  | { kind: "in-app-fit-check" }
  | { kind: "retire-confirm" }
  | { kind: "ask-advisor" }
  | { kind: "sent"; conversationId?: string };

const CARD_CLASS =
  "paon-wardrobe-piece relative flex shrink-0 snap-start flex-col overflow-hidden bg-[#191b1d]";

function CardImageLayers({
  imageUrl,
  alt,
}: {
  imageUrl: string | undefined;
  alt: string;
}) {
  if (!imageUrl) {
    return (
      <div
        className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-[var(--color-stone-800)] to-[var(--color-stone-950)]"
        aria-hidden="true"
      >
        <span className="font-display text-lg text-[var(--color-stone-400)]">
          {alt}
        </span>
      </div>
    );
  }
  return (
    // Natural aspect ratio, card height follows the image: never cropped,
    // never letterboxed.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={alt}
      className="block h-auto w-full"
      style={{ objectFit: "fill" }}
    />
  );
}

/** Caption sits below the image in normal flow so the image is never
 * covered, cropped or banded. */
function ProgressiveBottomPanel({ children }: { children: React.ReactNode }) {
  return <div className="paon-wardrobe-piece-caption">{children}</div>;
}

function DeckOverlay({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-[var(--color-stone-950)]/92 absolute inset-0 flex flex-col overflow-y-auto p-3.5 text-[var(--color-stone-100)] backdrop-blur-md transition-transform duration-300 ease-out ${
        open ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      {children}
    </div>
  );
}

function DeckBackRow({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="text-xs font-medium text-[var(--color-stone-300)] underline underline-offset-2"
      >
        Back
      </button>
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-stone-400)]">
        {label}
      </p>
    </div>
  );
}

function OwnedActionsDeck({
  retailerId,
  card,
}: {
  retailerId: string;
  card: OwnedCardModel;
}) {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<DeckScreen>({ kind: "menu" });
  const [selfScanConsent, setSelfScanConsent] = useState(false);

  const initialActionState: WardrobeActionState = { fieldErrors: {} };
  const [retireState, retireAction, retirePending] = useActionState(
    retireWardrobeItem,
    initialActionState,
  );
  const initialServiceState: WardrobeServiceRequestState = { fieldErrors: {} };
  const [serviceState, serviceAction, servicePending] = useActionState(
    requestWardrobeItemService,
    initialServiceState,
  );
  const [reorderState, reorderAction, reorderPending] = useActionState(
    requestWardrobeItemReorderViaAdvisor,
    initialServiceState,
  );
  const initialLifecycleState: LifecycleActionState = { fieldErrors: {} };
  const [selfScanState, selfScanAction, selfScanPending] = useActionState(
    submitWardrobeSelfScan,
    initialLifecycleState,
  );
  const initialAskState: AdvisorAskState = { fieldErrors: {} };
  const [askState, askAction, askPending] = useActionState(
    askAdvisorAboutWardrobeItem,
    initialAskState,
  );

  function closeDeck() {
    setOpen(false);
    setScreen({ kind: "menu" });
  }

  const item = card.item;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="paon-wardrobe-actions-btn absolute bottom-2.5 left-2.5 z-10"
        >
          Actions +
        </button>
      ) : null}

      <DeckOverlay open={open}>
        {screen.kind === "menu" ? (
          <div className="flex flex-col gap-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="line-clamp-1 text-[13px] font-medium">
                {item.displayName}
              </p>
              <button
                type="button"
                onClick={closeDeck}
                className="text-xs text-[var(--color-stone-300)] underline underline-offset-2"
              >
                Close
              </button>
            </div>
            <p className="text-[11px] leading-4 text-[var(--color-stone-400)]">
              {card.purchasedOnLabel}
            </p>
            {[
              {
                label: "Complete the look",
                onClick: () => setScreen({ kind: "complete-the-look" }),
              },
              {
                label: "Order again",
                onClick: () => setScreen({ kind: "order-again" }),
              },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="rounded-[10px] bg-white/[0.06] px-3 py-2 text-left text-[13px]"
              >
                {action.label}
              </button>
            ))}
            {(["repair", "alteration", "cleaning"] as const).map((kind) => (
              <form key={kind} action={serviceAction}>
                <input type="hidden" name="retailerId" value={retailerId} />
                <input type="hidden" name="wardrobeItemId" value={item.id} />
                <input type="hidden" name="kind" value={kind} />
                <button
                  type="submit"
                  disabled={servicePending}
                  className="w-full rounded-[10px] bg-white/[0.06] px-3 py-2 text-left text-[13px] disabled:opacity-50"
                >
                  {WARDROBE_SERVICE_REQUEST_KIND_LABELS[kind]}
                </button>
              </form>
            ))}
            <Link
              href={`/appointments?prefillReason=service_size_check&prefillWardrobeItemId=${item.id}`}
              className="rounded-[10px] bg-white/[0.06] px-3 py-2 text-left text-[13px]"
            >
              Request a fit-check in store
            </Link>
            {[
              {
                label: "Do a fit-check in app",
                onClick: () => setScreen({ kind: "in-app-fit-check" }),
              },
              {
                label: "Retire",
                onClick: () => setScreen({ kind: "retire-confirm" }),
              },
              {
                label: "Ask your advisor",
                onClick: () => setScreen({ kind: "ask-advisor" }),
              },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="rounded-[10px] bg-white/[0.06] px-3 py-2 text-left text-[13px]"
              >
                {action.label}
              </button>
            ))}
            {serviceState.success ? (
              <p
                role="status"
                className="text-xs text-[var(--color-success-500)]"
              >
                Request sent to your advisor.{" "}
                {serviceState.conversationId ? (
                  <Link
                    className="underline"
                    href={`/messages/${serviceState.conversationId}`}
                  >
                    View in Messages
                  </Link>
                ) : null}
              </p>
            ) : null}
            {retireState.success ? (
              <p
                role="status"
                className="text-xs text-[var(--color-success-500)]"
              >
                Garment marked retired.
              </p>
            ) : null}
          </div>
        ) : null}

        {screen.kind === "complete-the-look" ? (
          <div className="flex flex-col gap-2">
            <DeckBackRow
              onBack={() => setScreen({ kind: "menu" })}
              label="Complete the look"
            />
            {card.completeTheLookSuggestions.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {card.completeTheLookSuggestions.map((suggestion) => (
                  <SuggestedLookTile
                    key={suggestion.productId}
                    retailerId={retailerId}
                    suggestion={suggestion}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--color-stone-400)]">
                No real suggestions available for this item yet.
              </p>
            )}
          </div>
        ) : null}

        {screen.kind === "order-again" ? (
          <div className="flex flex-col gap-2">
            <DeckBackRow
              onBack={() => setScreen({ kind: "menu" })}
              label="Order again"
            />
            <p className="text-xs text-[var(--color-stone-300)]">
              Has this garment been altered by another tailor? We recommend an
              in-store fit check so your current size can be updated.
            </p>
            {card.productDetailHref ? (
              <Link
                href={card.productDetailHref}
                className="rounded-[10px] bg-white/[0.06] px-3 py-2 text-[13px]"
              >
                The size is perfect
              </Link>
            ) : (
              <form action={reorderAction}>
                <input type="hidden" name="retailerId" value={retailerId} />
                <input type="hidden" name="wardrobeItemId" value={item.id} />
                <Button type="submit" size="sm" disabled={reorderPending}>
                  Ask your advisor to reorder
                </Button>
              </form>
            )}
            <Link
              href={`/appointments?prefillReason=service_size_check&prefillWardrobeItemId=${item.id}`}
              className="rounded-[10px] bg-white/[0.06] px-3 py-2 text-[13px]"
            >
              Request a fit-check in store
            </Link>
            <button
              type="button"
              onClick={() => setScreen({ kind: "in-app-fit-check" })}
              className="rounded-[10px] bg-white/[0.06] px-3 py-2 text-left text-[13px]"
            >
              Do a fit-check in app
            </button>
            {reorderState.success ? (
              <p
                role="status"
                className="text-xs text-[var(--color-success-500)]"
              >
                Request sent to your advisor.{" "}
                {reorderState.conversationId ? (
                  <Link
                    className="underline"
                    href={`/messages/${reorderState.conversationId}`}
                  >
                    View in Messages
                  </Link>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        {screen.kind === "in-app-fit-check" ? (
          <form action={selfScanAction} className="flex flex-col gap-2">
            <DeckBackRow
              onBack={() => setScreen({ kind: "menu" })}
              label="Fit-check in app"
            />
            <input type="hidden" name="wardrobeItemId" value={item.id} />
            <label className="text-xs text-[var(--color-stone-300)]">
              Photo (optional)
              <input
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                className="mt-1 block w-full text-xs"
              />
            </label>
            <label className="text-xs text-[var(--color-stone-300)]">
              Notes
              <textarea
                name="notes"
                rows={2}
                className="mt-1 w-full rounded-[8px] bg-white/[0.08] p-2 text-xs"
              />
            </label>
            <label className="text-xs text-[var(--color-stone-300)]">
              Perceived fit
              <select
                name="fitPerceptionAtScan"
                defaultValue="true_to_size"
                className="mt-1 w-full rounded-[8px] bg-white/[0.08] p-2 text-xs"
              >
                <option value="true_to_size">True to size</option>
                <option value="slightly_tight">Slightly tight</option>
                <option value="slightly_loose">Slightly loose</option>
                <option value="needs_alteration">Needs alteration</option>
                <option value="unknown">Not sure</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--color-stone-300)]">
              <input type="checkbox" name="sizeChangeReported" />
              My size has changed
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--color-stone-300)]">
              <input
                type="checkbox"
                checked={selfScanConsent}
                onChange={(event) => setSelfScanConsent(event.target.checked)}
                required
              />
              I consent to sharing this self-reported photo/notes with my
              advisor. This never becomes an official measurement.
            </label>
            <input type="hidden" name="requestServiceHandoff" value="on" />
            <Button
              type="submit"
              size="sm"
              disabled={selfScanPending || !selfScanConsent}
            >
              Submit fit-check
            </Button>
            {selfScanState.success ? (
              <p
                role="status"
                className="text-xs text-[var(--color-success-500)]"
              >
                Fit-check submitted to your advisor.
              </p>
            ) : null}
            {selfScanState.formError ? (
              <p
                role="alert"
                className="text-xs text-[var(--color-danger-500)]"
              >
                {selfScanState.formError}
              </p>
            ) : null}
          </form>
        ) : null}

        {screen.kind === "retire-confirm" ? (
          <div className="flex flex-col gap-2">
            <DeckBackRow
              onBack={() => setScreen({ kind: "menu" })}
              label="Retire"
            />
            <p className="text-sm">
              Are you sure you want to retire {item.displayName}? Retired
              garments are kept for ownership and service history but no longer
              appear as active pieces.
            </p>
            <form action={retireAction} className="flex gap-2">
              <input type="hidden" name="retailerId" value={retailerId} />
              <input type="hidden" name="wardrobeItemId" value={item.id} />
              <Button type="submit" size="sm" disabled={retirePending}>
                Confirm retire
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setScreen({ kind: "menu" })}
              >
                Cancel
              </Button>
            </form>
          </div>
        ) : null}

        {screen.kind === "ask-advisor" ? (
          <div className="flex flex-col gap-2">
            <DeckBackRow
              onBack={() => setScreen({ kind: "menu" })}
              label="Ask your advisor"
            />
            <p className="text-xs text-[var(--color-stone-300)]">
              Sends a real message to your advisor with this garment attached.
            </p>
            {(["complete_the_look", "fit_check"] as const).map((prompt) => (
              <form key={prompt} action={askAction}>
                <input type="hidden" name="retailerId" value={retailerId} />
                <input type="hidden" name="wardrobeItemId" value={item.id} />
                <input type="hidden" name="starterPrompt" value={prompt} />
                <Button type="submit" size="sm" disabled={askPending}>
                  {prompt === "complete_the_look"
                    ? "Complete the look"
                    : "Request a fit-check"}
                </Button>
              </form>
            ))}
            {askState.success ? (
              <p
                role="status"
                className="text-xs text-[var(--color-success-500)]"
              >
                Sent to your advisor.{" "}
                {askState.conversationId ? (
                  <Link
                    className="underline"
                    href={`/messages/${askState.conversationId}`}
                  >
                    View in Messages
                  </Link>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}
      </DeckOverlay>
    </>
  );
}

function OwnedCard({
  retailerId,
  card,
}: {
  retailerId: string;
  card: OwnedCardModel;
}) {
  const item = card.item;
  return (
    <article className={CARD_CLASS} data-pe-card>
      <CardImageLayers
        imageUrl={item.identifyingPhotoUrl}
        alt={item.displayName}
      />
      <ProgressiveBottomPanel>
        <p className="paon-wardrobe-piece-name" title={card.purchasedOnLabel}>
          {item.displayName}
        </p>
        <span className="paon-wardrobe-actions-spacer" aria-hidden="true" />
      </ProgressiveBottomPanel>
      <OwnedActionsDeck retailerId={retailerId} card={card} />
    </article>
  );
}

function AdvisorSelectionCard({
  retailerId,
  gap,
  suggestedProduct,
  alternatives,
}: {
  retailerId: string;
  gap: WardrobeRoadmapGap;
  suggestedProduct: AdvisorSelectionProductLink | undefined;
  alternatives: readonly AdvisorSelectionAlternative[];
}) {
  const [open, setOpen] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const initialAskState: AdvisorAskState = { fieldErrors: {} };
  const [askState, askAction, askPending] = useActionState(
    askAdvisorAboutWardrobeItem,
    initialAskState,
  );
  const initialRemoveState: CustomerRoadmapActionState = { fieldErrors: {} };
  const [removeState, removeAction, removePending] = useActionState(
    removeAdvisorSelectionFromPlan,
    initialRemoveState,
  );

  // Phase 20.17 — once the removal persists the card is gone from the
  // customer's wardrobe plan (the server component also refetches without
  // it via revalidatePath).
  if (removeState.success) return null;

  return (
    <article className={CARD_CLASS} data-pe-card>
      <CardImageLayers
        imageUrl={suggestedProduct?.primaryImageUrl}
        alt={gap.title}
      />
      <span className="absolute left-2 top-2 z-10 rounded-full bg-[#c7c1ef] px-2 py-1 text-[11px] font-semibold text-[#181818]">
        Advisor selection
      </span>
      <ProgressiveBottomPanel>
        <p
          className="paon-wardrobe-piece-name"
          title={gap.howPurchaseFillsGap ?? undefined}
        >
          {gap.title}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="paon-wardrobe-actions-btn self-start"
        >
          Actions +
        </button>
      </ProgressiveBottomPanel>

      <DeckOverlay open={open}>
        <div className="flex flex-col gap-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="line-clamp-1 text-sm font-medium">{gap.title}</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowAlternatives(false);
                setConfirmRemove(false);
              }}
              className="text-xs text-[var(--color-stone-300)] underline underline-offset-2"
            >
              Close
            </button>
          </div>
          {confirmRemove ? (
            <div className="flex flex-col gap-2">
              <DeckBackRow
                onBack={() => setConfirmRemove(false)}
                label="Remove from wardrobe plan"
              />
              <p className="text-sm text-[var(--color-stone-200)]">
                Remove &ldquo;{gap.title}&rdquo; from your wardrobe plan? Your
                advisor keeps their original plan &mdash; this only hides the
                selection from your wardrobe.
              </p>
              <form action={removeAction} className="flex gap-2">
                <input type="hidden" name="retailerId" value={retailerId} />
                <input type="hidden" name="roadmapGapId" value={gap.id} />
                <Button type="submit" size="sm" disabled={removePending}>
                  Confirm removal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmRemove(false)}
                >
                  Cancel
                </Button>
              </form>
              {removeState.formError ? (
                <p
                  role="alert"
                  className="text-xs text-[var(--color-danger-500)]"
                >
                  {removeState.formError}
                </p>
              ) : null}
            </div>
          ) : !showAlternatives ? (
            <>
              {suggestedProduct ? (
                <Link
                  href={`/r/${retailerId}/products/${suggestedProduct.slug}`}
                  className="rounded-[10px] bg-white/[0.06] px-3 py-2 text-[13px]"
                >
                  Buy
                </Link>
              ) : null}
              <form action={askAction}>
                <input type="hidden" name="retailerId" value={retailerId} />
                <input
                  type="hidden"
                  name="starterPrompt"
                  value="discuss_roadmap_gap"
                />
                <input type="hidden" name="wardrobeItemId" value="" />
                <input type="hidden" name="roadmapGapTitle" value={gap.title} />
                <Button
                  type="submit"
                  size="sm"
                  disabled={askPending}
                  className="w-full"
                >
                  Discuss with advisor
                </Button>
              </form>
              <Link
                href={`/appointments?prefillReason=in_the_mood_for_something_fresh&prefillRoadmapGapId=${gap.id}`}
                className="rounded-[10px] bg-white/[0.06] px-3 py-2 text-[13px]"
              >
                Proceed in store
              </Link>
              <button
                type="button"
                onClick={() => setShowAlternatives(true)}
                className="rounded-[10px] bg-white/[0.06] px-3 py-2 text-left text-[13px]"
              >
                Explore alternatives
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="rounded-[10px] bg-white/[0.06] px-3 py-2 text-left text-[13px]"
              >
                Remove from wardrobe plan
              </button>
              {suggestedProduct ? (
                <Link
                  href={`/wardrobe?tab=fitting-room&fittingRoom_productSlug=${suggestedProduct.slug}`}
                  className="rounded-[10px] bg-white/[0.06] px-3 py-2 text-[13px]"
                >
                  Add to Digital Fitting Room
                </Link>
              ) : null}
              {askState.success ? (
                <p
                  role="status"
                  className="text-xs text-[var(--color-success-500)]"
                >
                  Sent to your advisor.
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <DeckBackRow
                onBack={() => setShowAlternatives(false)}
                label="Alternatives"
              />
              {alternatives.length > 0 ? (
                alternatives.slice(0, 6).map((alternative) => (
                  <Link
                    key={alternative.productId}
                    href={`/r/${retailerId}/products/${alternative.productSlug}`}
                    className="rounded-[10px] bg-white/[0.06] px-3 py-2 text-[13px]"
                  >
                    {alternative.displayName}
                  </Link>
                ))
              ) : (
                <p className="text-xs text-[var(--color-stone-400)]">
                  No real alternatives in this category yet.
                </p>
              )}
            </div>
          )}
        </div>
      </DeckOverlay>
    </article>
  );
}

function WardrobeRail({
  retailerId,
  label,
  ownedCards,
  gaps,
  suggestedProductByGapId,
  alternativesByCategory,
}: {
  retailerId: string;
  label: string;
  ownedCards: readonly OwnedCardModel[];
  gaps: readonly WardrobeRoadmapGap[];
  suggestedProductByGapId: Readonly<
    Record<string, AdvisorSelectionProductLink | undefined>
  >;
  alternativesByCategory: Readonly<
    Record<string, readonly AdvisorSelectionAlternative[]>
  >;
}) {
  const headerId = `wardrobe-rail-${retailerId}-${label}`;
  if (ownedCards.length === 0 && gaps.length === 0) {
    /* An empty category is one 40px line, not a card. */
    return (
      <Link
        href="/concierge"
        className="pe-wardrobe-empty-row"
        aria-labelledby={headerId}
        data-wardrobe-rail={label}
      >
        <span className="pe-wardrobe-empty-row-label">
          <span id={headerId}>{label}</span>
          <span className="pe-wardrobe-empty-row-meta">
            {" "}
            — none yet · Plan with your advisor
          </span>
        </span>
        <span aria-hidden="true" className="pe-wardrobe-empty-row-meta">
          ↗
        </span>
      </Link>
    );
  }

  return (
    <section
      aria-labelledby={headerId}
      data-wardrobe-rail={label}
      className="pe-wardrobe-populated paon-wardrobe-rail"
    >
      <div className="paon-wardrobe-rail-head">
        <h3 id={headerId}>{label}</h3>
        <span>
          {ownedCards.length + gaps.length} piece
          {ownedCards.length + gaps.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="paon-wardrobe-rail-track">
        {ownedCards.map((card) => (
          <OwnedCard key={card.item.id} retailerId={retailerId} card={card} />
        ))}
        {gaps.map((gap) => (
          <AdvisorSelectionCard
            key={gap.id}
            retailerId={retailerId}
            gap={gap}
            suggestedProduct={suggestedProductByGapId[gap.id]}
            alternatives={
              gap.categoryCode
                ? (alternativesByCategory[gap.categoryCode] ?? [])
                : []
            }
          />
        ))}
      </div>
    </section>
  );
}

function PendingRoadmapBanner({ roadmap }: { roadmap: PendingRoadmapSummary }) {
  const initialState: CustomerRoadmapActionState = { fieldErrors: {} };
  const [state, action, pending] = useActionState(
    decideWardrobeRoadmap,
    initialState,
  );

  if (state.success) return null;

  return (
    <div
      className="pe-card pe-card-lavender flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-[#c7c1ef] px-4 py-3 text-[#181818]"
      data-pe-card
    >
      <p className="text-sm font-medium">
        Your advisor shared a plan awaiting your review: {roadmap.title}
      </p>
      <div className="flex gap-2">
        <form action={action}>
          <input type="hidden" name="roadmapId" value={roadmap.id} />
          <input type="hidden" name="action" value="approve" />
          <Button type="submit" size="sm" disabled={pending}>
            Approve
          </Button>
        </form>
        <form action={action}>
          <input type="hidden" name="roadmapId" value={roadmap.id} />
          <input type="hidden" name="action" value="reject" />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Request changes
          </Button>
        </form>
      </div>
      {state.formError ? (
        <p
          role="alert"
          className="w-full text-xs text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}
    </div>
  );
}

export function WardrobeRailsPanel({
  retailerId,
  ownedCards,
  openGaps,
  suggestedProductIdByGapId,
  suggestedProductById,
  alternativesByCategory,
  pendingApprovalRoadmap,
}: {
  retailerId: string;
  ownedCards: readonly OwnedCardModel[];
  openGaps: readonly WardrobeRoadmapGap[];
  suggestedProductIdByGapId: Readonly<Record<string, string>>;
  suggestedProductById: Readonly<Record<string, AdvisorSelectionProductLink>>;
  alternativesByCategory: Readonly<
    Record<string, readonly AdvisorSelectionAlternative[]>
  >;
  pendingApprovalRoadmap: PendingRoadmapSummary | undefined;
}) {
  const suggestedProductByGapId: Record<
    string,
    AdvisorSelectionProductLink | undefined
  > = {};
  for (const [gapId, productId] of Object.entries(suggestedProductIdByGapId)) {
    suggestedProductByGapId[gapId] = suggestedProductById[productId];
  }

  return (
    <div className="flex flex-col gap-3">
      {pendingApprovalRoadmap ? (
        <PendingRoadmapBanner roadmap={pendingApprovalRoadmap} />
      ) : null}

      <StaggerReveal
        className="pe-wardrobe-rails"
        itemSelector="[data-wardrobe-rail]"
      >
        {WARDROBE_RAILS.map((rail) => (
          <WardrobeRail
            key={rail.id}
            retailerId={retailerId}
            label={rail.label}
            ownedCards={ownedCards.filter((card) =>
              (rail.categories as readonly GarmentCategoryCode[]).includes(
                card.item.categoryCode,
              ),
            )}
            gaps={openGaps.filter(
              (gap) =>
                gap.categoryCode &&
                (rail.categories as readonly GarmentCategoryCode[]).includes(
                  gap.categoryCode,
                ),
            )}
            suggestedProductByGapId={suggestedProductByGapId}
            alternativesByCategory={alternativesByCategory}
          />
        ))}
      </StaggerReveal>
    </div>
  );
}
