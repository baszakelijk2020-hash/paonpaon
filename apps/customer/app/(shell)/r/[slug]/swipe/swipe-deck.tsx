"use client";

import type { Money } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { formatMoney } from "@paon/utils";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { swipeLeft, swipeRight } from "./actions";
import { SWIPE_BOOKMARK_ICON, SWIPE_DISLIKE_ICON } from "./swipe-icons";

/**
 * Exact port of pag1.html's `#swipe-app-placeholder` ("munro-swipe-card")
 * widget — CSS values (card radius, container/button dimensions, the
 * layered "gummy" button shadows, the liked-carousel strip) and the
 * drag-to-swipe/exit-animation numbers are byte-for-byte from that source,
 * not paon-template.html's palette: pag1 is a separate, real design source
 * (see docs/DESIGN_PORTS.md) and this widget keeps its own literal colors
 * (#555555 text, #f0f0f0/#EBEBEB neutrals, #4caf50/#ff4c4c buttons) exactly
 * as table-service-widget.tsx keeps its own WhatsApp-green bubble rather
 * than being forced onto the storefront's warm stone tokens.
 *
 * Adapted for real data through the narrowest hook: the source's ten
 * static `atinderN.jpg` demo photos become real product cards, and its
 * `www.ateliermunro.com` end-of-deck pitch (a different brand entirely)
 * becomes real navigation back into this retailer's shop/wishlist. The
 * source's imperative "clone the card and animate a fixed clone" trick for
 * the swipe-out doesn't fit a React tree, so the departing card animates
 * itself with the same transform/timing values instead — same motion,
 * idiomatic implementation. The source's touch-only listeners become
 * pointer events so dragging also works with a mouse.
 */

export interface SwipeCard {
  productId: string;
  productSlug: string;
  name: string;
  imageUrl?: string;
  variantId: string;
  price: Money;
}

const SWIPE_THRESHOLD = 100;
const EXIT_DURATION_MS = 450;
const LIKED_SLOTS = 10;

export function SwipeDeck({
  slug,
  retailerId,
  deckVersion,
  cards,
  savedVariantIds,
  initialLikedCards,
}: {
  slug: string;
  retailerId: string;
  deckVersion: string;
  cards: SwipeCard[];
  savedVariantIds: string[];
  initialLikedCards: SwipeCard[];
}) {
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<SwipeCard[]>(initialLikedCards);
  const savedSet = new Set([
    ...savedVariantIds,
    ...liked.map((card) => card.variantId),
  ]);
  const [dragX, setDragX] = useState(0);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const dragging = useRef(false);
  const busy = useRef(false);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = cards[index];
  const likedSlotCount = LIKED_SLOTS;
  const exitDuration = prefersReducedMotion ? 0 : EXIT_DURATION_MS;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  async function commit(direction: "left" | "right") {
    const card = cards[index];
    if (!card || busy.current) return;
    busy.current = true;
    setErrorMessage(null);
    setExiting(direction);

    let persistenceError: unknown;
    const persistence =
      direction === "right"
        ? savedSet.has(card.variantId)
          ? Promise.resolve()
          : swipeRight(retailerId, card.variantId, card.productId, deckVersion)
        : swipeLeft(retailerId, card.productId, deckVersion);

    try {
      await persistence;
    } catch (error) {
      persistenceError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, exitDuration));

    if (persistenceError) {
      setDragX(0);
      setExiting(null);
      setErrorMessage(
        direction === "right"
          ? "That piece was not saved. Please try again."
          : "That choice was not recorded. Please try again.",
      );
      busy.current = false;
      return;
    }

    if (direction === "right") {
      setLiked((prev) => [...prev, card]);
    }
    setDragX(0);
    setExiting(null);
    setIndex((i) => i + 1);
    busy.current = false;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (exiting) return;
    dragging.current = true;
    startX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return;
    setDragX(event.clientX - startX.current);
  }
  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragX > SWIPE_THRESHOLD) void commit("right");
    else if (dragX < -SWIPE_THRESHOLD) void commit("left");
    else setDragX(0);
  }

  const containerWidth = containerRef.current?.offsetWidth ?? 390;
  const p = Math.min(Math.abs(dragX) / containerWidth, 1);

  let cardTransform = "translateZ(0)";
  let cardTransition = "none";
  let cardBoxShadow = "none";
  let cardOpacity = 1;
  if (exiting) {
    const endX = (exiting === "right" ? 1 : -1) * containerWidth * 1.5;
    const rotation = exiting === "right" ? 25 : -25;
    cardTransform = prefersReducedMotion
      ? "translateZ(0)"
      : `translate(${endX}px, 30px) rotate(${rotation}deg)`;
    cardTransition = prefersReducedMotion
      ? "none"
      : `transform ${EXIT_DURATION_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity ${EXIT_DURATION_MS}ms ease`;
    cardOpacity = 0;
  } else if (dragging.current || dragX !== 0) {
    cardTransform = `translate(${dragX}px, ${dragX * 0.05}px) scale(${1 + p * 0.05}) rotate(${dragX / 20}deg)`;
    cardTransition = "none";
    cardBoxShadow = `0px ${5 + p * 15}px ${10 + p * 20}px rgba(0,0,0,${p * 0.25})`;
  } else {
    cardTransition = "transform 0.3s ease-out, box-shadow 0.3s ease-out";
  }

  return (
    <div id="paon-swipe-deck" className="flex flex-1 flex-col items-center">
      <style>{`
        #paon-swipe-deck { width: 100%; display: flex; flex-direction: column; align-items: center; }
        #paon-swipe-deck .swipe-clip-wrapper { position: relative; width: 100%; max-width: 390px; overflow: visible; padding: 20px 20px 0 20px; box-sizing: border-box; }
        #paon-swipe-deck .swipe-container { position: relative; width: 100%; height: 555px; z-index: 100; touch-action: pan-y; overflow: visible; }
        #paon-swipe-deck .munro-swipe-card { position: absolute; top: 0; left: 0; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; appearance: none; border: 0; border-radius: 20px; background-color: #f0f0f0; background-size: cover; background-position: center; cursor: grab; user-select: none; font-family: OptimaKlein, sans-serif; font-size: 13px; text-align: center; color: #555555; padding: 20px; box-sizing: border-box; will-change: transform; }
        #paon-swipe-deck .munro-final-card { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; background: #f2f2f2; padding: 20px; }
        #paon-swipe-deck .card-label { display: flex; height: 25%; flex-direction: column; justify-content: center; padding: 0 20px; background: rgba(255,255,255,0.88); position: absolute; bottom: 0; left: 0; right: 0; border-radius: 0 0 20px 20px; }
        #paon-swipe-deck .buttons { display: flex; justify-content: center; margin-top: 20px; gap: 50px; }
        #paon-swipe-deck button.munro-swipe-btn { all: unset; cursor: pointer; position: relative; border-radius: 999vw; width: 60px; height: 60px; -webkit-tap-highlight-color: transparent; }
        #paon-swipe-deck button.munro-swipe-btn:active .button-outer { box-shadow: none; }
        #paon-swipe-deck .button-outer { position: relative; z-index: 1; border-radius: inherit; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0.05em 0.05em -0.01em rgba(5,5,5,1), 0 0.01em 0.01em -0.01em rgba(5,5,5,0.5), 0.15em 0.3em 0.1em -0.01em rgba(5,5,5,0.25); transition: box-shadow 300ms ease; }
        #paon-swipe-deck .button-inner { position: relative; z-index: 1; border-radius: inherit; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; transition: box-shadow 300ms ease, transform 250ms ease; overflow: clip; clip-path: inset(0 0 0 0 round 999vw); box-shadow: -0.05em -0.05em 0.05em 0 inset rgba(5,5,5,0.25), 0 0 0.05em 0.2em inset rgba(255,255,255,0.25), 0.025em 0.05em 0.1em 0 inset rgba(255,255,255,1), 0.12em 0.12em 0.12em inset rgba(255,255,255,0.25), -0.075em -0.25em 0.25em 0.1em inset rgba(5,5,5,0.25); }
        #paon-swipe-deck button.munro-swipe-btn:active .button-inner { transform: scale(0.975); transition: transform 0.05s ease-in; }
        #paon-swipe-deck button.munro-swipe-btn:disabled { cursor: wait; opacity: 0.72; }
        #paon-swipe-deck .button-inner img { width: 18px; height: auto; display: block; }
        #paon-swipe-deck #dislike .button-inner img { opacity: 0.75; width: 15px; }
        #paon-swipe-deck #dislike .button-inner { background-color: #ff4c4c; }
        #paon-swipe-deck #like .button-inner { background-color: #4caf50; }
        #paon-swipe-deck .liked-carousel { position: relative; width: 100%; margin-top: 40px; height: 115px; }
        #paon-swipe-deck .liked-track-wrapper { overflow-x: auto; overflow-y: hidden; height: 100%; display: flex; align-items: center; box-sizing: border-box; padding-right: 20px; scrollbar-width: none; }
        #paon-swipe-deck .liked-track-wrapper::-webkit-scrollbar { display: none; }
        #paon-swipe-deck .liked-track { display: flex; align-items: center; gap: 10px; width: max-content; scroll-snap-type: x mandatory; }
        #paon-swipe-deck .liked-item { flex: 0 0 auto; width: 70px; height: 105px; border-radius: 10px; background: #EBEBEB; background-position: center; background-size: cover; display: flex; align-items: center; justify-content: center; position: relative; scroll-snap-align: start; }
        #paon-swipe-deck .liked-item:first-child { margin-left: 20px; }
        #paon-swipe-deck .like-icon-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16.5px; height: 16.5px; background-image: url('${SWIPE_BOOKMARK_ICON}'); background-size: contain; background-repeat: no-repeat; background-position: center; filter: invert(1); opacity: 0.1; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) {
          #paon-swipe-deck .button-outer,
          #paon-swipe-deck .button-inner,
          #paon-swipe-deck .liked-item { transition: none !important; }
        }
      `}</style>

      <p className="sr-only" role="status" aria-live="polite">
        {current
          ? `Showing ${current.name}, item ${index + 1} of ${cards.length}`
          : "No more items"}
      </p>

      {current ? (
        <div className="swipe-clip-wrapper">
          <div className="swipe-container" ref={containerRef}>
            <button
              type="button"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  void commit("left");
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  void commit("right");
                }
              }}
              aria-label={`${current.name}. Press the right arrow to save or the left arrow to skip.`}
              aria-busy={exiting !== null}
              className="munro-swipe-card"
              style={{
                backgroundImage: current.imageUrl
                  ? `url('${current.imageUrl}')`
                  : undefined,
                transform: cardTransform,
                transition: cardTransition,
                boxShadow: cardBoxShadow,
                opacity: cardOpacity,
              }}
            >
              <div className="card-label">
                <p style={{ fontSize: 16, color: "#2a2925" }}>{current.name}</p>
                <p style={{ fontSize: 13, color: "#7a7870" }}>
                  {formatMoney(current.price, "en-US")}
                </p>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className="swipe-clip-wrapper">
          <div className="swipe-container">
            <div className="munro-swipe-card munro-final-card">
              <p>You&rsquo;ve seen everything for now.</p>
              <div className="flex gap-2">
                <Link
                  href={`/r/${slug}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Browse the full shop
                </Link>
                <Link
                  href={`/r/${slug}?favorites=1`}
                  className={buttonVariants({ size: "sm" })}
                >
                  See your favorites
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="buttons">
        <button
          type="button"
          id="dislike"
          className="munro-swipe-btn"
          aria-label="Skip"
          disabled={exiting !== null}
          onClick={() => void commit("left")}
        >
          <div className="button-outer">
            <div className="button-inner">
              {/* eslint-disable-next-line @next/next/no-img-element -- byte-for-byte source markup */}
              <img src={SWIPE_DISLIKE_ICON} alt="" />
            </div>
          </div>
        </button>
        <button
          type="button"
          id="like"
          className="munro-swipe-btn"
          aria-label="Save"
          disabled={exiting !== null}
          onClick={() => void commit("right")}
        >
          <div className="button-outer">
            <div className="button-inner">
              {/* eslint-disable-next-line @next/next/no-img-element -- byte-for-byte source markup */}
              <img
                src={SWIPE_BOOKMARK_ICON}
                alt=""
                style={{ width: 16.5, height: "auto", opacity: 0.8 }}
              />
            </div>
          </div>
        </button>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-3 text-center text-sm text-[var(--color-error-700,#9f2929)]"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="liked-carousel">
        <div className="liked-track-wrapper">
          <div className="liked-track">
            {Array.from({ length: likedSlotCount }, (_, i) => {
              const item = liked[i];
              return (
                <div
                  key={item?.variantId ?? i}
                  className="liked-item"
                  style={
                    item?.imageUrl
                      ? { backgroundImage: `url('${item.imageUrl}')` }
                      : undefined
                  }
                >
                  {!item ? <div className="like-icon-overlay" /> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
