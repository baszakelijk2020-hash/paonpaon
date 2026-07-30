"use client";

import {
  DEFAULT_PRODUCT_DWELL_THRESHOLD_MS,
  DEFAULT_SESSION_HEARTBEAT_INTERVAL_MS,
  resolveTieMateKeyboardAction,
  type Money,
  type TieMateFabricPhotoRole,
} from "@paon/domain";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { formatMoney } from "@paon/utils";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { saveTieMateFabric, skipTieMateFabric } from "./actions";
import {
  endTieMateSession,
  heartbeatTieMateSession,
  startTieMateSession,
  trackTieMateContextEvent,
} from "./session-actions";

export interface TieMateDeckCard {
  readonly productId: string;
  readonly productSlug: string;
  readonly name: string;
  readonly variantId: string;
  readonly price: Money;
  readonly inventoryQuantity: number;
  readonly inStock: boolean;
  readonly fabricImageUrl: string;
  readonly fabricPhotoRole: TieMateFabricPhotoRole;
  readonly productPath: string;
  readonly orderPath: string;
  readonly appointmentPath: string;
  readonly messagesPath: string;
  readonly swipeHandoffPath: string;
}

const SWIPE_THRESHOLD = 80;
const EXIT_DURATION_MS = 320;
const SESSION_STORAGE_KEY = "paon.tieMate.sessionId";

/**
 * Interim Tie-Mate surface (founder-authorized): PAON storefront tokens,
 * phone-scale full-bleed fabric, swipe/save/buy/advisor handoffs into
 * existing paths. Not a founder-HTML port and not Hermès/Tie Break chrome.
 */
export function TieMateDeck({
  slug,
  retailerId,
  retailerName,
  cards,
  savedVariantIds,
  isSignedIn,
}: {
  slug: string;
  retailerId: string;
  retailerName: string;
  cards: readonly TieMateDeckCard[];
  savedVariantIds: readonly string[];
  isSignedIn: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [savedLocal, setSavedLocal] = useState<string[]>([]);
  const [dragX, setDragX] = useState(0);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const impressionKeysRef = useRef<Set<string>>(new Set());
  const dwellTimersRef = useRef<Map<string, number>>(new Map());

  const current = cards[index];
  const remaining = Math.max(cards.length - index, 0);

  const advance = useCallback(() => {
    setDragX(0);
    setExiting(null);
    setIndex((i) => i + 1);
  }, []);

  const emitCardContext = useCallback(
    (card: TieMateDeckCard) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;

      const impressionKey = `${sessionId}:tie_mate_impression:${card.variantId}`;
      if (!impressionKeysRef.current.has(impressionKey)) {
        impressionKeysRef.current.add(impressionKey);
        void trackTieMateContextEvent({
          retailerId,
          slug,
          sessionId,
          name: "tie_mate_impression",
          idempotencyKey: impressionKey,
          context: {
            productId: card.productId,
            productVariantId: card.variantId,
          },
        });
        void trackTieMateContextEvent({
          retailerId,
          slug,
          sessionId,
          name: "product_card_impression",
          idempotencyKey: `${sessionId}:product_card:${card.variantId}`,
          context: {
            productId: card.productId,
            productVariantId: card.variantId,
          },
        });
      }

      if (dwellTimersRef.current.has(card.variantId)) return;
      const timer = window.setTimeout(() => {
        void trackTieMateContextEvent({
          retailerId,
          slug,
          sessionId,
          name: "product_dwell_threshold",
          idempotencyKey: `${sessionId}:dwell:${card.variantId}`,
          context: {
            productId: card.productId,
            productVariantId: card.variantId,
            dwellMs: DEFAULT_PRODUCT_DWELL_THRESHOLD_MS,
          },
        });
      }, DEFAULT_PRODUCT_DWELL_THRESHOLD_MS);
      dwellTimersRef.current.set(card.variantId, timer);
    },
    [retailerId, slug],
  );

  useEffect(() => {
    if (!isSignedIn) return;

    let cancelled = false;
    const resumeSessionId =
      window.sessionStorage.getItem(SESSION_STORAGE_KEY) ?? undefined;

    void startTieMateSession({
      retailerId,
      slug,
      ...(resumeSessionId ? { resumeSessionId } : {}),
    }).then((result) => {
      if (cancelled || !result.ok) return;
      sessionIdRef.current = result.sessionId;
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, result.sessionId);
    });

    const heartbeat = window.setInterval(() => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      const visibilityState =
        document.visibilityState === "visible" ? "visible" : "hidden";
      void heartbeatTieMateSession({
        retailerId,
        slug,
        sessionId,
        visibilityState,
      });
    }, DEFAULT_SESSION_HEARTBEAT_INTERVAL_MS);

    const onVisibilityChange = () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      const visibilityState =
        document.visibilityState === "visible" ? "visible" : "hidden";
      void heartbeatTieMateSession({
        retailerId,
        slug,
        sessionId,
        visibilityState,
      });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        void endTieMateSession({ retailerId, slug, sessionId });
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    };
  }, [isSignedIn, retailerId, slug]);

  useEffect(() => {
    if (!current || !isSignedIn) return;
    const variantId = current.variantId;
    const timers = dwellTimersRef.current;
    emitCardContext(current);
    return () => {
      const timer = timers.get(variantId);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timers.delete(variantId);
      }
    };
  }, [current, emitCardContext, isSignedIn]);

  const commit = useCallback(
    (direction: "left" | "right") => {
      const card = cards[index];
      if (!card || exiting) return;

      if (direction === "right" && !isSignedIn) {
        window.location.href = `/login?redirectTo=${encodeURIComponent(`/r/${slug}/tie-mate`)}`;
        return;
      }

      setExiting(direction);
      setActionError(null);

      if (direction === "right") {
        const alreadySaved =
          savedVariantIds.includes(card.variantId) ||
          savedLocal.includes(card.variantId);
        if (!alreadySaved) {
          setSavedLocal((prev) => [...prev, card.variantId]);
          void saveTieMateFabric({
            retailerId,
            slug,
            productVariantId: card.variantId,
            productId: card.productId,
            ...(sessionIdRef.current
              ? { sessionId: sessionIdRef.current }
              : {}),
          }).then((result) => {
            if (!result.ok) setActionError(result.error);
          });
        }
      } else if (isSignedIn) {
        void skipTieMateFabric({
          retailerId,
          productId: card.productId,
          ...(sessionIdRef.current ? { sessionId: sessionIdRef.current } : {}),
        });
      }

      window.setTimeout(advance, EXIT_DURATION_MS);
    },
    [
      advance,
      cards,
      exiting,
      index,
      isSignedIn,
      retailerId,
      savedLocal,
      savedVariantIds,
      slug,
    ],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!cards[index] || exiting) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const action = resolveTieMateKeyboardAction(event.key);
      if (action === "skip") {
        event.preventDefault();
        commit("left");
      } else if (action === "save") {
        event.preventDefault();
        commit("right");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cards, commit, exiting, index]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (exiting || !current) return;
    dragging.current = true;
    startX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    setDragX(event.clientX - startX.current);
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragX > SWIPE_THRESHOLD) commit("right");
    else if (dragX < -SWIPE_THRESHOLD) commit("left");
    else setDragX(0);
  }

  const stageWidth = stageRef.current?.offsetWidth ?? 390;
  const progress = Math.min(Math.abs(dragX) / stageWidth, 1);

  let fabricTransform = "translate3d(0,0,0)";
  let fabricTransition = "none";
  let fabricOpacity = 1;
  if (exiting) {
    const endX = (exiting === "right" ? 1 : -1) * stageWidth * 1.15;
    fabricTransform = `translate3d(${endX}px, 12px, 0) rotate(${exiting === "right" ? 8 : -8}deg)`;
    fabricTransition = `transform ${EXIT_DURATION_MS}ms ease-out, opacity ${EXIT_DURATION_MS}ms ease-out`;
    fabricOpacity = 0;
  } else if (dragging.current || dragX !== 0) {
    fabricTransform = `translate3d(${dragX}px, ${dragX * 0.04}px, 0) rotate(${dragX / 28}deg)`;
    fabricOpacity = 1 - progress * 0.08;
  } else {
    fabricTransition = "transform 0.25s ease-out";
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-[var(--color-stone-950)] text-[#f0efec]">
      <header className="mx-auto flex w-full max-w-md items-start justify-between gap-3 px-4 pb-2 pt-4 sm:px-6">
        <div>
          <p className="font-accent text-[0.65rem] font-medium uppercase tracking-[0.16em] text-[var(--color-stone-400)]">
            {retailerName}
          </p>
          <h1 className="font-display text-2xl text-[#f0efec]">Tie-Mate</h1>
          <p className="mt-1 max-w-[18rem] text-xs text-[var(--color-stone-400)]">
            Hold the phone against a shirt. Swipe right to save, left to skip.
          </p>
        </div>
        <p className="pt-1 text-xs tabular-nums text-[var(--color-stone-400)]">
          {remaining > 0 ? `${index + 1} / ${cards.length}` : "Done"}
        </p>
      </header>

      <p className="sr-only" role="status" aria-live="polite">
        {current
          ? `Showing ${current.name}. ${current.inStock ? "In stock." : "Out of stock."} Item ${index + 1} of ${cards.length}. Use arrow keys to skip or save.`
          : "No more fabrics in this deck."}
      </p>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 sm:px-6">
        {/* Phone-scale stage: full-bleed on narrow viewports; constrained frame on desktop. */}
        <div
          ref={stageRef}
          className="relative mx-auto aspect-[9/16] max-h-[min(72dvh,640px)] w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-stone-900)]"
        >
          {current ? (
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
              style={{
                transform: fabricTransform,
                transition: fabricTransition,
                opacity: fabricOpacity,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed fabric asset; remote retailer CDN */}
              <img
                src={current.fabricImageUrl}
                alt={`Fabric close-up of ${current.name}`}
                className="h-full w-full object-cover"
                draggable={false}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-4 pb-5 pt-16">
                <p className="font-display text-xl text-white">
                  {current.name}
                </p>
                <p className="mt-1 text-sm text-white/85">
                  {formatMoney(current.price, "en-US")}
                  {" · "}
                  {current.inStock
                    ? current.inventoryQuantity > 0
                      ? `${current.inventoryQuantity} in stock`
                      : "Made to order"
                    : "Out of stock"}
                </p>
                {current.fabricPhotoRole === "primary_fallback" ? (
                  <p className="mt-1 text-xs text-white/65">
                    Using product image — ask the house for a sharp fabric
                    swatch.
                  </p>
                ) : null}
              </div>
              {dragX > 24 ? (
                <span className="pointer-events-none absolute left-4 top-4 rounded-[var(--radius-md)] border border-white/40 bg-black/35 px-3 py-1 text-xs uppercase tracking-wide text-white">
                  Save
                </span>
              ) : null}
              {dragX < -24 ? (
                <span className="pointer-events-none absolute right-4 top-4 rounded-[var(--radius-md)] border border-white/40 bg-black/35 px-3 py-1 text-xs uppercase tracking-wide text-white">
                  Skip
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="font-display text-2xl text-[#f0efec]">
                You&rsquo;ve seen every fabric
              </p>
              <p className="text-sm text-[var(--color-stone-400)]">
                Open a saved piece, browse the shop, or ask an advisor.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href="/wishlist"
                  className={buttonVariants({ size: "sm" })}
                >
                  Wishlist
                </Link>
                <Link
                  href={`/r/${slug}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Shop
                </Link>
              </div>
            </div>
          )}
        </div>

        {actionError ? (
          <p
            role="alert"
            className="mt-3 text-sm text-[var(--color-danger-500)]"
          >
            {actionError}
          </p>
        ) : null}

        {current ? (
          <div className="mt-4 flex flex-col gap-3 pb-8">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                aria-label="Skip this fabric"
                onClick={() => commit("left")}
                disabled={!!exiting}
                className="border-[var(--color-stone-600)] text-[#f0efec] hover:bg-[var(--color-stone-800)]"
              >
                Skip
              </Button>
              <Button
                type="button"
                aria-label={
                  isSignedIn
                    ? "Save this fabric"
                    : "Sign in to save this fabric"
                }
                onClick={() => commit("right")}
                disabled={!!exiting}
              >
                {isSignedIn ? "Save" : "Sign in to save"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={current.orderPath}
                className={buttonVariants({
                  variant: "secondary",
                  className: "justify-center",
                })}
              >
                Buy / view
              </Link>
              <Link
                href={current.appointmentPath}
                className={buttonVariants({
                  variant: "secondary",
                  className: "justify-center",
                })}
              >
                Ask advisor
              </Link>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[var(--color-stone-400)]">
              <Link className="underline" href={current.messagesPath}>
                Messages
              </Link>
              <Link className="underline" href={current.swipeHandoffPath}>
                Open in swipe
              </Link>
              <Link className="underline" href={current.productPath}>
                Product page
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
