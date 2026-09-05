"use client";

import type { KnowledgeTopic } from "@paon/domain";
import { useEffect, useRef, useState } from "react";

type NudgeData = {
  knowledgeObjectId: string;
  title: string;
  teaser: string;
  topic: KnowledgeTopic;
} | null;

/**
 * The nudge is computed server-side in the layout, at the same request
 * that already resolves the customer's session reliably (see
 * getProactiveNudge's call site in layout.tsx) — this widget only owns
 * the 20-second dwell delay before revealing already-known data. An
 * earlier version fetched the nudge from a client-triggered Server
 * Action fired by this component's own setTimeout; that call
 * intermittently failed to resolve the customer's session despite the
 * identical mechanism working reliably for immediate on-mount calls
 * elsewhere on the page, for reasons not fully root-caused. Fetching
 * once, synchronously, in the same request that renders the page
 * removes that whole class of failure.
 */
export function ProactiveNudgeWidget({
  initialNudge,
}: {
  initialNudge: NudgeData;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isHidden, setIsHidden] = useState(false);

  // Hide floating widgets when actionable panels open to prevent covering
  // their interactive controls (filter panel, product detail, etc.).
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const classes = document.body.className;
      const shouldHide =
        classes.includes("filter-active") ||
        classes.includes("product-detail-open") ||
        classes.includes("filter-closing");
      setIsHidden(shouldHide);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Check initial state
    const classes = document.body.className;
    const shouldHide =
      classes.includes("filter-active") ||
      classes.includes("product-detail-open") ||
      classes.includes("filter-closing");
    setIsHidden(shouldHide);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!initialNudge) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 20000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [initialNudge]);

  if (!initialNudge) {
    return null;
  }

  const topicLabel =
    {
      mill: "mills",
      fibre: "fibres",
      fabric: "fabrics",
      weave: "weaves",
      construction: "construction",
      collar: "collars",
      styling: "styling",
      care: "care",
      performance: "performance",
      occasion: "occasions",
      value: "value",
      tradeoff: "tradeoffs",
    }[initialNudge.topic] || "topics";

  return (
    <div
      className={`fixed bottom-28 right-5 z-40 flex flex-col items-end gap-2 transition-all duration-500 ease-out ${
        isVisible && !isHidden
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0"
      } ${isHidden ? "pointer-events-none" : "pointer-events-auto"}`}
    >
      <div className="w-[min(23.5rem,calc(100vw-2.5rem))] overflow-hidden rounded-[10px] bg-white p-4 shadow-[var(--shadow-elevated)]">
        <div className="space-y-2">
          <div className="text-xs text-stone-500">
            Since you&apos;ve been exploring {topicLabel}, your advisor thought
            you&apos;d like this:
          </div>
          <h3 className="text-sm font-medium text-stone-900">
            {initialNudge.title}
          </h3>
          <p className="line-clamp-2 text-xs text-stone-700">
            {initialNudge.teaser}
          </p>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              className="text-xs font-medium text-stone-500 hover:text-stone-700"
              aria-label="Dismiss advisor nudge"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
