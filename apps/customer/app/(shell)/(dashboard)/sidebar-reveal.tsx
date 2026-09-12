"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * The sidebar's navigation arrives in sequence whenever the customer crosses
 * between the store and the wardrobe: every row — Home and Collection and the
 * categories under it, or the account destinations — fades up one after
 * another at an even pace, and the rule beside the categories draws down at
 * that same pace so its tip is always at the row that has just appeared.
 *
 * The fades are CSS animations, not a JS timeline. A switch is the busiest
 * moment this app has — a layer slides, a storefront focuses in, live video
 * keeps decoding — and a tweened opacity only advances when the main thread
 * hands out a frame. Under that load the rows jumped from hidden to solid
 * with nothing in between, which is what made a fade read as a switch.
 * Composited animations keep fading regardless; JS here only indexes the
 * rows and says when to begin.
 *
 * The first paint of the page is left alone: the menu is simply there. It
 * only animates on a mount that follows a Store / Wardrobe switch.
 */

/**
 * One row's fade, and the gap before the next starts. Both fixed, so the pace
 * between items is the same in every menu and a longer list simply runs
 * longer. A long fade over a long gap read as a slow dissolve; a short fade
 * arriving quickly reads as the list assembling itself.
 */
const ROW_DURATION = 0.34;
const ROW_STEP = 0.055;

/** If the environment never reports settling, start anyway after this. */
const SETTLE_FALLBACK_MS = 400;

/** Rows, in the order they are painted. */
const ITEM_SELECTOR = ".paon-side-row, .paon-side-category";

/*
 * The sidebar's pinned bottom block — Locations, How it works, About Us,
 * Contact — is deliberately NOT part of this reveal. It is the same four rows
 * in both environments and it stays constant across a switch; only the menu
 * that actually changes animates.
 */

let mountedBefore = false;

export function SidebarReveal({
  environment,
  children,
}: {
  /** Which switch this menu belongs to, so it starts when that side lands. */
  environment: "store" | "customer";
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  // Decided during render, so a re-mount paints its rows hidden from the very
  // first frame (via the class below) rather than a beat later from an
  // effect — on a busy main thread that beat was a visible flash of the whole
  // menu. The first mount of the page hydrates unanimated.
  const [animate] = useState(() => mountedBefore);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    if (!animate) {
      mountedBefore = true;
      return;
    }
    const rows = Array.from(node.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
    if (
      rows.length === 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      node.classList.remove("is-pending");
      return;
    }

    const step = ROW_STEP;
    node.style.setProperty("--paon-reveal-duration", `${ROW_DURATION}s`);
    node.style.setProperty("--paon-reveal-step", `${step}s`);
    rows.forEach((row, index) => {
      row.style.setProperty("--paon-reveal-index", String(index));
    });

    // The rule spans only the category rows: it starts when the first one
    // does and finishes as the last one starts.
    const firstCategory = rows.findIndex((row) =>
      row.classList.contains("paon-side-category"),
    );
    const lastCategory = rows.reduce(
      (found, row, index) =>
        row.classList.contains("paon-side-category") ? index : found,
      -1,
    );
    if (firstCategory !== -1) {
      node.style.setProperty("--paon-rule-delay", `${firstCategory * step}s`);
      node.style.setProperty(
        "--paon-rule-duration",
        `${Math.max((lastCategory - firstCategory) * step, 0.01)}s`,
      );
    }

    // Held until the environment is actually on screen: the switch slides the
    // other layer away first, and a reveal that ran under it was half done by
    // the time anyone could see it.
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      node.classList.remove("is-pending");
      node.classList.add("is-revealing");
    };
    const onSettled = (event: Event) => {
      if ((event as CustomEvent<string>).detail === environment) start();
    };
    window.addEventListener("paon:environment-settled", onSettled);
    const fallback = window.setTimeout(start, SETTLE_FALLBACK_MS);

    return () => {
      window.removeEventListener("paon:environment-settled", onSettled);
      window.clearTimeout(fallback);
    };
  }, [animate, environment]);

  return (
    <div
      ref={root}
      className={["paon-side-reveal", animate ? "is-pending" : ""].join(" ")}
    >
      {children}
    </div>
  );
}

/** The category list, with the rule the reveal draws down beside it. */
export function CategoryList({ children }: { children: ReactNode }) {
  return (
    <div className="paon-side-categories">
      <span className="paon-side-rule" aria-hidden="true" />
      {children}
    </div>
  );
}
