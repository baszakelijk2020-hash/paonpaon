"use client";

import type { KnowledgeTopic } from "@paon/domain";
import { useEffect, useRef, useState } from "react";

import { getProactiveNudge } from "./proactive-nudge-actions";

export function ProactiveNudgeWidget({ retailerId }: { retailerId: string }) {
  const [nudge, setNudge] = useState<{
    knowledgeObjectId: string;
    title: string;
    teaser: string;
    topic: KnowledgeTopic;
  } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Wait 20 seconds before showing nudge
    timeoutRef.current = setTimeout(async () => {
      const result = await getProactiveNudge(retailerId);
      if (result) {
        setNudge(result);
        setIsVisible(true);
      }
    }, 20000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [retailerId]);

  if (!nudge) {
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
    }[nudge.topic] || "topics";

  return (
    <div
      className={`fixed bottom-28 right-5 z-40 flex flex-col items-end gap-2 transition-transform duration-500 ease-out ${
        isVisible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="w-[min(23.5rem,calc(100vw-2.5rem))] overflow-hidden rounded-[10px] bg-white p-4 shadow-[var(--shadow-elevated)]">
        <div className="space-y-2">
          <div className="text-xs text-stone-500">
            Since you&apos;ve been exploring {topicLabel}, your advisor thought
            you&apos;d like this:
          </div>
          <h3 className="text-sm font-medium text-stone-900">{nudge.title}</h3>
          <p className="line-clamp-2 text-xs text-stone-700">{nudge.teaser}</p>
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
