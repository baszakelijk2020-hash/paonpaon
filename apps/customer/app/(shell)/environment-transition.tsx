"use client";

import { gsap } from "gsap";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { usePaonEnvironment } from "./environment-store";

/**
 * A 100px left-origin focus reveal for the My PAON environment.
 */
const ENTER_DURATION = 0.24;
const ENTER_OPACITY_DURATION = 0.12;
const EXIT_DURATION = 0.2;
/*
 * The customer environment focuses in: it arrives blurred and sharpens as it
 * lands. Only on the way in, only for the length of the move, and the filter
 * is removed the moment it finishes — a `filter` left standing on a layer
 * this size (ten live video players) puts every later frame through a filter
 * pass, which is what made the whole app jittery. The storefront focuses in
 * the same way on the way back, and is likewise handed back unfiltered.
 */
const ENTER_BLUR = "blur(14px)";
/*
 * Matched to the home grid's per-card unblur, which is the pace the whole
 * storefront already focuses at: `transition: … filter .9s ease` from
 * `blur(14px)` on every card image. At 0.34s the environment snapped into
 * focus so fast it read as a cut rather than a lens finding its subject, and
 * next to a card settling over nearly a second it looked like a different
 * app. Same radius, same duration; `power1.inOut` is the closest stock GSAP
 * curve to CSS `ease` (cubic-bezier(.25, .1, .25, 1)).
 */
const ENTER_BLUR_DURATION = 0.9;
const ENTER_BLUR_EASE_CSS = "ease";

/**
 * Focus an element in with a CSS transition, not a GSAP tween.
 *
 * A switch is the busiest moment the app has — one layer sliding away, the
 * other repainting behind it, ten live video players decoding — and a tween
 * only advances when the main thread hands out a frame. Under that load the
 * blur jumped from 14px to sharp in one or two steps: the "pop" on the way
 * back into the store. A `filter` transition is composited, so it keeps every
 * frame regardless of what the main thread is doing.
 *
 * Starts from the full blur with the transition disarmed, flushes that so the
 * browser has actually painted it, then arms the transition and releases.
 * Returns a cancel function; both completion and cancellation restore the
 * element and run `done`.
 */
function focusIn(
  el: HTMLElement,
  opts: { delay: number; reducedMotion: boolean; done: () => void },
): () => void {
  let finished = false;
  let timer = 0;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    el.removeEventListener("transitionend", onEnd);
    el.style.transition = "";
    el.style.filter = "";
    el.style.willChange = "";
    opts.done();
  };
  const onEnd = (event: TransitionEvent) => {
    if (event.target === el && event.propertyName === "filter") finish();
  };
  if (opts.reducedMotion) {
    finish();
    return finish;
  }
  el.style.willChange = "filter";
  el.style.transition = "none";
  el.style.filter = ENTER_BLUR;
  void el.offsetWidth;
  el.style.transition = `filter ${ENTER_BLUR_DURATION}s ${ENTER_BLUR_EASE_CSS} ${opts.delay}s`;
  el.style.filter = "blur(0px)";
  el.addEventListener("transitionend", onEnd);
  // transitionend is not guaranteed (a tab hidden mid-transition skips it), so
  // the same cleanup runs on a timer just past the transition's own end.
  timer = window.setTimeout(
    finish,
    (opts.delay + ENTER_BLUR_DURATION) * 1000 + 80,
  );
  return finish;
}

/**
 * Slides the customer environment out from behind the left sidebar, over the
 * storefront, and back again.
 *
 * Both are alive at once: the storefront is a live subtree in <body> that is
 * never rebuilt, and the customer environment is a fixed overlay above it. So
 * moving between them is not a page change at all — it is one panel sliding
 * over another that never goes anywhere. Nothing is fetched, nothing is
 * routed, nothing is remounted; the only thing that changes is a transform.
 *
 * The panel begins 100px left of its final position, then shoots right into
 * place from zero opacity and a product-card blur. It never moves vertically
 * or scales.
 */
export function EnvironmentTransition() {
  const pathname = usePathname();
  const environment = usePaonEnvironment(pathname);
  const inStore = environment === "store";
  const first = useRef(true);
  const cancelCustomerFocus = useRef<(() => void) | null>(null);
  const cancelStorefrontFocus = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const overlay = document.querySelector<HTMLElement>(
      "[data-paon-customer-layer]",
    );
    if (!overlay) return;

    document.body.classList.toggle("paon-storefront-active", inStore);
    overlay.setAttribute("aria-hidden", String(inStore));
    overlay.inert = inStore;

    const away = { x: -100, opacity: 0, force3D: true };
    const here = { x: 0, opacity: 1, force3D: true };
    // Anything a previous build left behind.
    overlay.style.filter = "";

    // First paint: put the panel at the right end with no animation, or it
    // flies in from the corner on load.
    if (first.current) {
      first.current = false;
      gsap.set(overlay, inStore ? away : here);
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reducedMotion
      ? 0
      : inStore
        ? EXIT_DURATION
        : ENTER_DURATION;

    // A switch pressed mid-switch continues from where the panel actually is,
    // rather than restarting from the far end.
    gsap.killTweensOf(overlay);
    // Promoted for the length of the move only. Left on permanently, a layer
    // this size is re-rastered on every window-resize frame, and the storefront
    // shows through while it is being redrawn.
    overlay.style.willChange = inStore
      ? "transform, opacity"
      : "transform, opacity, filter";
    /*
     * Fired before the panel has moved, so anything that reveals itself with
     * the incoming environment can take its starting state while it is still
     * off screen. `paon:environment-settled` is too late for that: by the time
     * it fires the layer is fully visible, so a reveal armed there shows its
     * finished state for a beat, snaps back to hidden and only then plays.
     */
    window.dispatchEvent(
      new CustomEvent("paon:environment-entering", {
        detail: inStore ? "store" : "customer",
      }),
    );
    const target = inStore ? away : here;
    const transition = gsap.timeline({
      onComplete: () => {
        overlay.style.willChange = "";
        // The other environment is fully on screen now — anything that wants
        // to animate in with it (the sidebar's category reveal) starts here.
        window.dispatchEvent(
          new CustomEvent("paon:environment-settled", {
            detail: inStore ? "store" : "customer",
          }),
        );
      },
    });
    if (inStore) {
      transition.to(
        overlay,
        {
          x: target.x,
          opacity: target.opacity,
          duration,
          ease: "power3.in",
          force3D: true,
        },
        0,
      );
    } else {
      transition
        .to(
          overlay,
          {
            x: target.x,
            duration,
            ease: "power4.out",
            force3D: true,
          },
          0,
        )
        .to(
          overlay,
          {
            opacity: target.opacity,
            duration: reducedMotion ? 0 : ENTER_OPACITY_DURATION,
            ease: "power2.out",
          },
          0,
        );
    }
    if (!inStore) {
      /*
       * Focus in, then hand the layer back unfiltered.
       *
       * The blur goes on the layer's CHILD, not on the layer itself, and the
       * layer is painted in the environment's own colour for the length of the
       * tween. A `filter: blur()` fades an element's own edges out to
       * transparent — the falloff reaches about a radius inside the border box,
       * not just outside it — so blurring the full-window layer directly let
       * the pale storefront behind it show through all the way round, which is
       * the white ring around the window. Clipping does not help: the falloff
       * is inside the box. Giving the blurred child an opaque backdrop of the
       * same colour it is carrying means the edges fade into their own shade
       * and there is nothing to see.
       */
      const inner = overlay.firstElementChild as HTMLElement | null;
      const blurTarget = inner ?? overlay;
      // The environment's real background, not the wrapper's — the wrapper is
      // pale even when the page inside it is near-black.
      const env = overlay.querySelector<HTMLElement>(".paon-env");
      const backdrop = env
        ? getComputedStyle(env).backgroundColor
        : getComputedStyle(blurTarget).backgroundColor;
      const hadBackdrop = backdrop && backdrop !== "rgba(0, 0, 0, 0)";
      if (hadBackdrop) overlay.style.backgroundColor = backdrop;
      cancelCustomerFocus.current?.();
      cancelCustomerFocus.current = focusIn(blurTarget, {
        delay: 0,
        reducedMotion,
        done: () => {
          cancelCustomerFocus.current = null;
          if (hadBackdrop) overlay.style.backgroundColor = "";
        },
      });
    }

    const storefront = document.querySelector<HTMLElement>(
      ".paon-template-root",
    );
    if (!storefront) return;
    // A switch pressed mid-focus cancels the running one; cancelling restores
    // the element and the <body> backdrop, so nothing is left painted.
    cancelStorefrontFocus.current?.();
    if (!inStore) {
      storefront.style.filter = "";
      storefront.style.willChange = "";
      return;
    }
    /*
     * The same edge falloff the customer layer has, answered the same way but
     * from underneath. The storefront fills the window, so there is no child
     * to blur in its place — instead the page behind it is painted in its own
     * colour for the length of the tween, and the soft edge fades into a
     * matching shade rather than into the pale default <body>. Without this
     * the top of the feed washed out to white on the way in.
     */
    /*
     * Which colour the edges fade into depends on the view. On the grids the
     * root's own ground is right. On a product detail the root is still that
     * pale ground, but nothing pale reaches the window's edges — the header
     * bar, the right-hand panel and the sidebar are all dark — so fading to
     * the root colour drew a pale halo around a dark page. There the panel's
     * colour is the one the eye expects at the edge.
     */
    const detailPanel = storefront.classList.contains("product-detail-open")
      ? document.getElementById("detail-right")
      : null;
    const panelBackdrop = detailPanel
      ? getComputedStyle(detailPanel).backgroundColor
      : "";
    const storefrontBackdrop =
      panelBackdrop && panelBackdrop !== "rgba(0, 0, 0, 0)"
        ? panelBackdrop
        : getComputedStyle(storefront).backgroundColor;
    const paintsBackdrop =
      storefrontBackdrop && storefrontBackdrop !== "rgba(0, 0, 0, 0)";
    if (paintsBackdrop) {
      document.body.style.backgroundColor = storefrontBackdrop;
    }
    cancelStorefrontFocus.current = focusIn(storefront, {
      // The customer layer is on top of it for the length of its exit, so a
      // focus that started with the click would be most of the way done
      // before any of it was visible.
      delay: EXIT_DURATION * 0.8,
      reducedMotion,
      done: () => {
        cancelStorefrontFocus.current = null;
        if (paintsBackdrop) document.body.style.backgroundColor = "";
      },
    });
  }, [inStore]);

  /*
   * Put the panel back at its resting end after a resize.
   *
   * Crossing the 1024px breakpoint changes the panel's `left` (it clears the
   * sidebar above that width and fills the window below it), which changes the
   * width its -100% rest position is measured against. Re-asserting settles it
   * in one frame instead of leaving a stale transform behind the drag.
   */
  useEffect(() => {
    const overlay = document.querySelector<HTMLElement>(
      "[data-paon-customer-layer]",
    );
    if (!overlay) return;
    let frame = 0;
    const settle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (gsap.isTweening(overlay)) return;
        gsap.set(
          overlay,
          inStore ? { x: -100, opacity: 0 } : { x: 0, opacity: 1 },
        );
      });
    };
    window.addEventListener("resize", settle);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", settle);
    };
  }, [inStore]);

  useEffect(() => {
    const applyStorefrontAccessibility = () => {
      const storefront = document.querySelector<HTMLElement>(
        ".paon-template-root",
      );
      if (!storefront) return false;
      storefront.inert = !inStore;
      storefront.setAttribute("aria-hidden", String(!inStore));
      return true;
    };

    if (applyStorefrontAccessibility()) return;
    const observer = new MutationObserver(() => {
      if (applyStorefrontAccessibility()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [inStore]);

  return null;
}
