"use client";

import { useEffect, useRef } from "react";

import { VOX_CSS, VOX_SCRIPT } from "./vox-source";

/**
 * Verbatim port of the founder's `vox-` fit-slider widget (ADR-052,
 * docs/DESIGN_PORTS.md). The CSS and JS in `./vox-source.ts` are extracted
 * unmodified from `downloaded_pages/pag1.html` — chip-slider momentum,
 * rubber-banding, wheel/trackpad handling, Dutch speech recognition, the
 * both-shoulders combo and the grace-period refinement window all run as
 * the founder wrote them.
 *
 * This replaces `voice-measurement-slider.tsx`, which re-expressed the
 * widget in Tailwind and, by its own header comment, dropped the wheel
 * handler, the both-shoulders combo and the grace-period window. Do not
 * reintroduce that approach: the design is the product, and a faithful
 * rewrite is still a rewrite.
 *
 * The only seam between the widget and React is a `vox:apply` CustomEvent,
 * dispatched from one added line inside the founder's own `applyValue`.
 * React never touches the widget's DOM, so there is nothing for the two
 * render models to fight over.
 */

function formatVoxValue(value: number): string {
  if (value === 0) return "0";
  return (value > 0 ? "+" : "") + value.toFixed(1);
}

export function VoxFitSlider({
  onApply,
}: {
  onApply: (area: string, value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // The widget is initialised once and never re-run; keeping the callback in
  // a ref means a new `onApply` identity from the parent cannot tear it down
  // and rebuild it mid-fitting.
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function handleApply(event: Event) {
      const detail = (event as CustomEvent<{ field: string; value: number }>)
        .detail;
      if (!detail) return;
      onApplyRef.current(detail.field, formatVoxValue(detail.value));
    }

    root.addEventListener("vox:apply", handleApply);

    const script = document.createElement("script");
    script.textContent = VOX_SCRIPT;
    document.body.appendChild(script);

    return () => {
      root.removeEventListener("vox:apply", handleApply);
      script.remove();
    };
  }, []);

  return (
    <>
      {/* The founder's stylesheet, injected verbatim per ADR-052. It is a
          committed static asset, never user input. */}
      <style dangerouslySetInnerHTML={{ __html: VOX_CSS }} />
      <div ref={rootRef} className="vox-widget-root" data-vox-widget>
        <div className="vox-widget-container" />
        <div className="vox-voice-overlay-fixed">
          <div className="vox-spotlight" />
          <div className="vox-spotlight2" />
        </div>
      </div>
    </>
  );
}
