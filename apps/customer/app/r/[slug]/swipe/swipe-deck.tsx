"use client";

import type { Money } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { formatMoney } from "@paon/utils";
import Link from "next/link";
import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { trackStorefrontEvent } from "../track-actions";

import { swipeLeft, swipeRight } from "./actions";

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
  cards,
  savedVariantIds,
  occasionQuery,
}: {
  slug: string;
  retailerId: string;
  cards: SwipeCard[];
  savedVariantIds: string[];
  occasionQuery?: string;
}) {
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<SwipeCard[]>([]);
  const savedSet = new Set([
    ...savedVariantIds,
    ...liked.map((card) => card.variantId),
  ]);
  const [dragX, setDragX] = useState(0);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = cards[index];
  const likedSlotCount = Math.min(LIKED_SLOTS, cards.length || LIKED_SLOTS);

  function commit(direction: "left" | "right") {
    const card = cards[index];
    if (!card || exiting) return;
    setExiting(direction);
    if (direction === "right") {
      setLiked((prev) => [...prev, card]);
      if (!savedSet.has(card.variantId)) {
        void swipeRight(retailerId, card.variantId, card.productId);
      }
    } else {
      void swipeLeft(retailerId, card.productId);
    }
    setTimeout(() => {
      setDragX(0);
      setExiting(null);
      setIndex((i) => i + 1);
    }, EXIT_DURATION_MS);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (exiting) return;
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

  const containerWidth = containerRef.current?.offsetWidth ?? 390;
  const p = Math.min(Math.abs(dragX) / containerWidth, 1);

  let cardTransform = "translateZ(0)";
  let cardTransition = "none";
  let cardBoxShadow = "none";
  let cardOpacity = 1;
  if (exiting) {
    const endX = (exiting === "right" ? 1 : -1) * containerWidth * 1.5;
    const rotation = exiting === "right" ? 25 : -25;
    cardTransform = `translate(${endX}px, 30px) rotate(${rotation}deg)`;
    cardTransition = `transform ${EXIT_DURATION_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity ${EXIT_DURATION_MS}ms ease`;
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
        #paon-swipe-deck .swipe-clip-wrapper { position: relative; width: 100%; max-width: 390px; overflow: visible; box-sizing: border-box; }
        #paon-swipe-deck .swipe-container { position: relative; width: 100%; height: 555px; touch-action: pan-y; overflow: visible; }
        #paon-swipe-deck .munro-swipe-card { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 20px; background-color: #f0f0f0; background-size: cover; background-position: center; cursor: grab; user-select: none; font-family: OptimaKlein, sans-serif; font-size: 13px; text-align: center; color: #555555; box-sizing: border-box; }
        #paon-swipe-deck .munro-final-card { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; background: #f2f2f2; padding: 20px; }
        #paon-swipe-deck .card-label { display: flex; height: 25%; flex-direction: column; justify-content: center; padding: 0 20px; background: rgba(255,255,255,0.88); position: absolute; bottom: 0; left: 0; right: 0; border-radius: 0 0 20px 20px; }
        #paon-swipe-deck .buttons { display: flex; justify-content: center; margin-top: 20px; gap: 50px; }
        #paon-swipe-deck button.munro-swipe-btn { all: unset; cursor: pointer; position: relative; border-radius: 999vw; width: 60px; height: 60px; -webkit-tap-highlight-color: transparent; }
        #paon-swipe-deck button.munro-swipe-btn:active .button-outer { box-shadow: none; }
        #paon-swipe-deck .button-outer { position: relative; z-index: 1; border-radius: inherit; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0.05em 0.05em -0.01em rgba(5,5,5,1), 0 0.01em 0.01em -0.01em rgba(5,5,5,0.5), 0.15em 0.3em 0.1em -0.01em rgba(5,5,5,0.25); transition: box-shadow 300ms ease; }
        #paon-swipe-deck .button-inner { position: relative; z-index: 1; border-radius: inherit; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; transition: box-shadow 300ms ease, transform 250ms ease; overflow: clip; clip-path: inset(0 0 0 0 round 999vw); box-shadow: -0.05em -0.05em 0.05em 0 inset rgba(5,5,5,0.25), 0 0 0.05em 0.2em inset rgba(255,255,255,0.25), 0.025em 0.05em 0.1em 0 inset rgba(255,255,255,1), 0.12em 0.12em 0.12em inset rgba(255,255,255,0.25), -0.075em -0.25em 0.25em 0.1em inset rgba(5,5,5,0.25); }
        #paon-swipe-deck button.munro-swipe-btn:active .button-inner { transform: scale(0.975); transition: transform 0.05s ease-in; }
        #paon-swipe-deck .button-inner img { width: 18px; height: auto; display: block; }
        #paon-swipe-deck #dislike .button-inner img { opacity: 0.75; width: 15px; }
        #paon-swipe-deck #dislike .button-inner { background-color: #ff4c4c; }
        #paon-swipe-deck #like .button-inner { background-color: #4caf50; }
        #paon-swipe-deck .liked-carousel { position: relative; width: 100%; margin-top: 40px; height: 115px; }
        #paon-swipe-deck .liked-track-wrapper { overflow-x: auto; overflow-y: hidden; height: 100%; display: flex; align-items: center; box-sizing: border-box; padding: 0 20px; scrollbar-width: none; }
        #paon-swipe-deck .liked-track-wrapper::-webkit-scrollbar { display: none; }
        #paon-swipe-deck .liked-track { display: flex; align-items: center; gap: 10px; width: max-content; }
        #paon-swipe-deck .liked-item { flex: 0 0 auto; width: 70px; height: 105px; border-radius: 10px; background: #EBEBEB; background-position: center; background-size: cover; position: relative; }
        #paon-swipe-deck .like-icon-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16.5px; height: 16.5px; background-image: url('https://www.nebelspiegel.com/images/bookmarkwhite.png'); background-size: contain; background-repeat: no-repeat; background-position: center; filter: invert(1); opacity: 0.1; pointer-events: none; }
      `}</style>

      <p className="sr-only" role="status" aria-live="polite">
        {current
          ? `Showing ${current.name}, item ${index + 1} of ${cards.length}`
          : "No more items"}
      </p>

      {current ? (
        <div className="swipe-clip-wrapper">
          <div className="swipe-container" ref={containerRef}>
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
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
            </div>
          </div>
        </div>
      ) : (
        <div className="swipe-clip-wrapper">
          <div className="swipe-container">
            <div className="munro-swipe-card munro-final-card">
              <p>You&rsquo;ve seen everything for now.</p>
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-2">
                  <Link
                    href={`/r/${slug}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
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
                <Link
                  href={`/r/${slug}/appointments${occasionQuery ? `?occasion=${encodeURIComponent(occasionQuery.replace(/\s+/g, "-"))}` : ""}`}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "sm",
                  })}
                  onClick={() => {
                    void trackStorefrontEvent(
                      retailerId,
                      "appointment_intent",
                      {
                        via: "swipe",
                        ...(occasionQuery ? { occasion: occasionQuery } : {}),
                      },
                    );
                  }}
                >
                  Book an appointment
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
          onClick={() => commit("left")}
        >
          <div className="button-outer">
            <div className="button-inner">
              {/* eslint-disable-next-line @next/next/no-img-element -- byte-for-byte source markup */}
              <img
                src="https://www.nebelspiegel.com/images/closetinder.png"
                alt=""
              />
            </div>
          </div>
        </button>
        <button
          type="button"
          id="like"
          className="munro-swipe-btn"
          aria-label="Save"
          onClick={() => commit("right")}
        >
          <div className="button-outer">
            <div className="button-inner">
              {/* eslint-disable-next-line @next/next/no-img-element -- byte-for-byte source markup */}
              <img
                src="https://www.nebelspiegel.com/images/bookmarkwhite.png"
                alt=""
                style={{ width: 16.5, height: "auto", opacity: 0.8 }}
              />
            </div>
          </div>
        </button>
      </div>

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
