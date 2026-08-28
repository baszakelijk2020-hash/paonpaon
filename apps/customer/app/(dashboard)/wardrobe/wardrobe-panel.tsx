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
import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

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

const EMPTY_SLOT_COUNT = 10;

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
  "relative h-80 w-56 shrink-0 snap-start overflow-hidden rounded-[15px] bg-[var(--color-stone-900)]";

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
        className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--color-stone-800)] to-[var(--color-stone-950)]"
        aria-hidden="true"
      >
        <span className="font-display text-lg text-[var(--color-stone-400)]">
          {alt}
        </span>
      </div>
    );
  }
  return (
    <>
      {/* Restrained blurred full-bleed background: the same garment image,
          cropped and softened, so the letterbox band beside the uncropped
          foreground reads as a deliberate darkened blur of the piece and is
          never plain white — even for studio shots on white. */}
      <Image
        src={imageUrl}
        alt=""
        fill
        unoptimized
        aria-hidden="true"
        className="scale-110 object-cover opacity-60 blur-2xl"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-black/40" />
      {/* The complete original image, uncropped, no artificial margin — stays
          the primary image above the restrained background. */}
      <Image
        src={imageUrl}
        alt={alt}
        fill
        unoptimized
        className="object-contain"
      />
    </>
  );
}

/** Apple App Store-style progressive bottom blur: no hard panel edge, no
 * solid caption rectangle. A backdrop-blur layer fades in via a mask, and a
 * separate colour gradient darkens gradually beneath it. */
function ProgressiveBottomPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%]">
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{
          WebkitMaskImage: "linear-gradient(to top, black 40%, transparent)",
          maskImage: "linear-gradient(to top, black 40%, transparent)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3.5">
        {children}
      </div>
    </div>
  );
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
          className="absolute bottom-3.5 left-3.5 z-10 text-sm font-medium text-white underline-offset-2 hover:underline"
        >
          Actions +
        </button>
      ) : null}

      <DeckOverlay open={open}>
        {screen.kind === "menu" ? (
          <div className="flex flex-col gap-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="line-clamp-1 text-sm font-medium">
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
                className="rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-left text-sm"
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
                  className="w-full rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-left text-sm disabled:opacity-50"
                >
                  {WARDROBE_SERVICE_REQUEST_KIND_LABELS[kind]}
                </button>
              </form>
            ))}
            <Link
              href={`/appointments?prefillReason=service_size_check&prefillWardrobeItemId=${item.id}`}
              className="rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-left text-sm"
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
                className="rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-left text-sm"
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
                className="rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-sm"
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
              className="rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-sm"
            >
              Request a fit-check in store
            </Link>
            <button
              type="button"
              onClick={() => setScreen({ kind: "in-app-fit-check" })}
              className="rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-left text-sm"
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
    <article className={CARD_CLASS}>
      <CardImageLayers
        imageUrl={item.identifyingPhotoUrl}
        alt={item.displayName}
      />
      <ProgressiveBottomPanel>
        <p className="font-display truncate text-[20px] text-white">
          {item.displayName}
        </p>
        <p className="text-xs text-[var(--color-stone-200)]">
          {card.purchasedOnLabel}
        </p>
        <span className="h-5" aria-hidden="true" />
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
    <article className={CARD_CLASS}>
      <CardImageLayers
        imageUrl={suggestedProduct?.primaryImageUrl}
        alt={gap.title}
      />
      <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-stone-800)]">
        Advisor selection
      </span>
      <ProgressiveBottomPanel>
        <p className="font-display truncate text-[20px] text-white">
          {gap.title}
        </p>
        {gap.howPurchaseFillsGap ? (
          <p className="line-clamp-2 text-xs text-[var(--color-stone-200)]">
            {gap.howPurchaseFillsGap}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start text-sm font-medium text-white underline-offset-2 hover:underline"
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
                  className="rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-sm"
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
                className="rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-sm"
              >
                Proceed in store
              </Link>
              <button
                type="button"
                onClick={() => setShowAlternatives(true)}
                className="rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-left text-sm"
              >
                Explore alternatives
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-left text-sm"
              >
                Remove from wardrobe plan
              </button>
              {suggestedProduct ? (
                <Link
                  href={`/digital-fitting-room?productSlug=${suggestedProduct.slug}`}
                  className="rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-sm"
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
                    className="rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-sm"
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

function EmptySlot() {
  return (
    <div
      className="flex h-80 w-56 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[15px] bg-[radial-gradient(circle_at_50%_38%,rgba(166,181,157,0.12),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.065),rgba(255,255,255,0.015))]"
      aria-hidden="true"
      data-empty-slot
    >
      <span className="text-2xl text-[var(--color-stone-500)]">+</span>
    </div>
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

  return (
    <section
      aria-labelledby={headerId}
      data-wardrobe-rail={label}
      className="border-t border-white/10 py-6 first:border-t-0"
    >
      <div className="flex items-baseline justify-between gap-3 px-5 sm:px-10 lg:px-14">
        <h3 id={headerId} className="font-display text-xl text-white">
          {label}
        </h3>
        <span className="text-xs text-[var(--color-stone-400)]">
          {ownedCards.length} piece{ownedCards.length === 1 ? "" : "s"}
        </span>
      </div>
      <div
        className="mt-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-2 sm:px-10 lg:px-14"
        style={{ scrollbarWidth: "thin" }}
      >
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
        {Array.from({ length: EMPTY_SLOT_COUNT }, (_, index) => (
          <EmptySlot key={index} />
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 bg-white/[0.035] px-5 py-4">
      <p className="text-sm text-white">
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
    <div className="flex flex-col">
      {pendingApprovalRoadmap ? (
        <PendingRoadmapBanner roadmap={pendingApprovalRoadmap} />
      ) : null}

      <div className="flex flex-col">
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
      </div>
    </div>
  );
}
