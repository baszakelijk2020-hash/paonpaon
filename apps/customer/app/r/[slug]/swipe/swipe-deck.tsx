"use client";

import type { Money } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import { formatMoney } from "@paon/utils";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { swipeLeft, swipeRight } from "./actions";

export interface SwipeCard {
  productId: string;
  productSlug: string;
  name: string;
  imageUrl?: string;
  variantId: string;
  price: Money;
}

const SWIPE_THRESHOLD = 110;
const VISIBLE_STACK = 3;

export function SwipeDeck({
  slug,
  retailerId,
  cards,
  savedVariantIds,
}: {
  slug: string;
  retailerId: string;
  cards: SwipeCard[];
  savedVariantIds: string[];
}) {
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  const savedSet = new Set([...savedVariantIds, ...saved]);
  const [dragX, setDragX] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const listener = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  const remaining = cards.slice(index, index + VISIBLE_STACK);

  function commit(direction: "left" | "right") {
    const card = cards[index];
    if (!card) return;
    if (direction === "right") {
      setSaved((prev) => [...prev, card.variantId]);
      if (!savedSet.has(card.variantId)) {
        void swipeRight(retailerId, card.variantId, card.productId);
      }
    } else {
      void swipeLeft(retailerId, card.productId);
    }
    setDragX(0);
    setIndex((i) => i + 1);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
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

  if (remaining.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-[var(--color-stone-600)]">
          You&rsquo;ve seen everything for now.
        </p>
        <div className="flex gap-2">
          <Link
            href={`/r/${slug}/products`}
            className={buttonVariants({ variant: "outline" })}
          >
            Browse the full shop
          </Link>
          <Link href="/wishlist" className={buttonVariants()}>
            See your favorites
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <p className="sr-only" role="status" aria-live="polite">
        {cards[index]
          ? `Showing ${cards[index].name}, item ${index + 1} of ${cards.length}`
          : "No more items"}
      </p>
      <div className="relative h-[26rem] w-full max-w-sm">
        {remaining
          .map((card, depth) => ({ card, depth }))
          .reverse()
          .map(({ card, depth }) => {
            const isTop = depth === 0;
            const rotate = isTop ? dragX / 18 : 0;
            const translateX = isTop ? dragX : 0;
            const translateY = depth * 10;
            const scale = 1 - depth * 0.04;
            return (
              <div
                key={card.variantId}
                onPointerDown={isTop ? onPointerDown : undefined}
                onPointerMove={isTop ? onPointerMove : undefined}
                onPointerUp={isTop ? onPointerUp : undefined}
                onPointerCancel={isTop ? onPointerUp : undefined}
                className="absolute inset-0 select-none overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-stone-200)] bg-[var(--color-stone-0,#fff)]"
                style={{
                  transform: `translate(${translateX}px, ${translateY}px) rotate(${rotate}deg) scale(${scale})`,
                  transition:
                    dragging.current || reducedMotion
                      ? "none"
                      : "transform var(--duration-quiet) var(--ease-out-quiet)",
                  touchAction: "pan-y",
                  cursor: isTop ? "grab" : "default",
                  zIndex: VISIBLE_STACK - depth,
                  boxShadow: "var(--shadow-elevated)",
                }}
              >
                {card.imageUrl ? (
                  <Image
                    src={card.imageUrl}
                    alt=""
                    width={400}
                    height={400}
                    unoptimized
                    draggable={false}
                    className="h-3/4 w-full object-cover"
                  />
                ) : (
                  <div className="h-3/4 w-full bg-[var(--color-stone-100)]" />
                )}
                <div className="flex h-1/4 flex-col justify-center px-5">
                  <p className="text-lg font-[var(--font-display)] text-[var(--color-stone-900)]">
                    {card.name}
                  </p>
                  <p className="text-sm text-[var(--color-stone-600)]">
                    {formatMoney(card.price, "en-US")}
                  </p>
                </div>
                {isTop && dragX > 30 ? (
                  <div
                    aria-hidden="true"
                    className="absolute right-5 top-5 rounded-full border-2 border-[var(--color-success-500)] px-3 py-1 text-sm font-medium text-[var(--color-success-500)]"
                  >
                    SAVE
                  </div>
                ) : null}
                {isTop && dragX < -30 ? (
                  <div
                    aria-hidden="true"
                    className="absolute left-5 top-5 rounded-full border-2 border-[var(--color-danger-500)] px-3 py-1 text-sm font-medium text-[var(--color-danger-500)]"
                  >
                    SKIP
                  </div>
                ) : null}
              </div>
            );
          })}
      </div>

      <div className="mt-8 flex items-center gap-6">
        <button
          type="button"
          aria-label="Skip"
          onClick={() => commit("left")}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-stone-300)] text-xl text-[var(--color-stone-600)] transition-[background-color,color,transform] duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] hover:border-[var(--color-danger-500)] hover:text-[var(--color-danger-500)] active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          ✕
        </button>
        <Link
          href={`/r/${slug}/products/${cards[index]?.productSlug ?? ""}`}
          className="text-sm text-[var(--color-stone-500)] underline underline-offset-4"
        >
          View details
        </Link>
        <button
          type="button"
          aria-label="Save"
          onClick={() => commit("right")}
          className="hover:bg-[var(--color-success-500)]/10 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-stone-300)] text-xl text-[var(--color-danger-500)] transition-[background-color,color,transform] duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] hover:border-[var(--color-success-500)] active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          ♥
        </button>
      </div>
    </div>
  );
}
