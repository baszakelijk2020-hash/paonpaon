"use client";

/*
 * LOCKED — drives the founder-approved watch face (13 Sep 2026). Changes here
 * move the dial's light; see analogue-clock.tsx and
 * docs/evidence/locked/watch-face/ before touching it.
 */

import { useEffect } from "react";

/**
 * Makes the overview's mother-of-pearl answer to the pointer, as a pearl
 * watch face does when it is turned in the hand: the bloom of light slides
 * towards the pointer and the colour bands rotate, so the rose, mint and blue
 * travel across the surface instead of sitting still.
 *
 * Two kinds of pearl follow it. The watch face is SVG, so its gradients are
 * moved directly — the sheen's centre, the ground's angle and the positions
 * of its inner colour stops. The cards and Add to Bag are CSS, so they read
 * three custom properties set here. Those are set on the pieces column
 * alone: a custom property set on the root would restyle the whole document
 * on every frame the pointer moves, including the column with the live
 * picture in it.
 *
 * The pointer is followed with easing, not tracked to the pixel, so the light
 * moves with some weight, the way a turned object does; the loop runs only
 * while the light is still catching up and stops once it has settled. Off
 * entirely for viewers who have asked for reduced motion.
 */

/** Ids the watch face gives its gradients (analogue-clock.tsx). */
const FACE_FILL_ID = "paon-analogue-face-fill";
const SHEEN_ID = "paon-analogue-pearl-sheen";

/** How far the colour bands turn, in degrees, at the edges of the window. */
const TURN_X = 60;
const TURN_Y = 28;
/** How far the sheen travels from its resting place, as a share of the face. */
const SHEEN_TRAVEL = 0.42;
/** How far the inner colour stops slide, as a share of the gradient. */
const STOP_SLIDE = 0.18;
/** Resting positions of the face's inner stops (analogue-clock.tsx). */
const FACE_STOPS = [0, 0.3, 0.52, 0.72, 1];
/** Share of the remaining distance covered per frame. */
const EASE = 0.16;

export function PearlLight() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scope = document.querySelector<HTMLElement>(
      ".paon-overview-morning .paon-morning-pieces",
    );
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;

    const apply = () => {
      x += (targetX - x) * EASE;
      y += (targetY - y) * EASE;
      const turn = x * TURN_X + y * TURN_Y;

      if (scope) {
        scope.style.setProperty("--pearl-dx", x.toFixed(4));
        scope.style.setProperty("--pearl-dy", y.toFixed(4));
        scope.style.setProperty("--pearl-rot", `${turn.toFixed(2)}deg`);
      }

      const sheen = document.getElementById(SHEEN_ID);
      sheen?.setAttribute("cx", (0.32 + x * SHEEN_TRAVEL).toFixed(4));
      sheen?.setAttribute("cy", (0.28 + y * SHEEN_TRAVEL).toFixed(4));

      const face = document.getElementById(FACE_FILL_ID);
      if (face) {
        face.setAttribute(
          "gradientTransform",
          `rotate(${(-45 + turn).toFixed(2)} 0.5 0.5)`,
        );
        /* The inner stops slide, so the bands of colour shift against one
           another — the part of the effect that reads as nacre rather than
           a tint being turned. The end stops stay put. */
        face.querySelectorAll("stop").forEach((stop, index) => {
          const rest = FACE_STOPS[index];
          if (
            rest === undefined ||
            index === 0 ||
            index === FACE_STOPS.length - 1
          )
            return;
          const slid = Math.min(0.95, Math.max(0.05, rest + x * STOP_SLIDE));
          stop.setAttribute("offset", slid.toFixed(4));
        });
      }

      const settled =
        Math.abs(targetX - x) < 0.001 && Math.abs(targetY - y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(apply);
    };

    const onMove = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth) * 2 - 1;
      targetY = (event.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
