"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

/** Tactile feedback is attached only to intentional controls, never whole forms. */
export function EnvironmentMotion() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const shell = marker.current?.closest<HTMLElement>("[data-customer-shell]");
    if (!shell) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animated = new Set<HTMLElement>();
    let pressed: HTMLElement | null = null;
    const release = () => {
      if (!pressed) return;
      gsap.to(pressed, {
        scale: 1,
        duration: 0.42,
        ease: "back.out(1.6)",
        clearProps: "transform",
        overwrite: true,
      });
      pressed = null;
    };
    const down = (event: PointerEvent) => {
      if (
        media.matches ||
        event.button !== 0 ||
        !(event.target instanceof Element)
      )
        return;
      const control = event.target.closest<HTMLElement>(
        "button:not(:disabled),a[data-pe-card],a.customer-button",
      );
      if (!control || !shell.contains(control)) return;
      // Feed selectors are a hard cut, never a press.
      if (control.closest("[data-no-press]")) return;
      pressed = control;
      animated.add(control);
      gsap.to(control, {
        scale: 0.97,
        duration: 0.15,
        ease: "power2.out",
        overwrite: true,
      });
    };
    shell.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      shell.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      for (const control of animated) gsap.killTweensOf(control);
    };
  }, []);
  return <span ref={marker} hidden aria-hidden="true" />;
}
