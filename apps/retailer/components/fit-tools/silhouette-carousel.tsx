"use client";

import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * Port of pag1's `nbs-silhouette-` body-type carousel. Same drag
 * interaction as apps/customer/app/r/[slug]/swipe/swipe-deck.tsx (pointer
 * capture, threshold-based commit, motion-reduce handling) applied to a
 * horizontal snap-carousel instead of a card stack, since the original
 * widget scrolls between body-type silhouettes rather than discarding
 * them.
 */

interface SilhouetteType {
  name: string;
  description: string;
  path: string;
}

const SILHOUETTES: SilhouetteType[] = [
  {
    name: "Slank",
    description: "Smalle schouderlijn, strak getailleerd",
    path: "M50 8c-6 0-10 5-10 11 0 5 3 9 7 10-9 3-15 9-16 18l-3 33h44l-3-33c-1-9-7-15-16-18 4-1 7-5 7-10 0-6-4-11-10-11z",
  },
  {
    name: "Regulier",
    description: "Klassieke pasvorm, gebalanceerde lijn",
    path: "M50 8c-7 0-11 5-11 12 0 5 3 9 8 10-10 3-17 10-18 19l-3 31h48l-3-31c-1-9-8-16-18-19 5-1 8-5 8-10 0-7-4-12-11-12z",
  },
  {
    name: "Atletisch",
    description: "Brede schouders, versmalde taille",
    path: "M50 8c-8 0-13 6-13 13 0 6 4 10 9 11-13 3-21 9-23 17l-4 31h62l-4-31c-2-8-10-14-23-17 5-1 9-5 9-11 0-7-5-13-13-13z",
  },
  {
    name: "Gezet",
    description: "Ruimere pasvorm door romp en schouder",
    path: "M50 8c-7 0-12 6-12 13 0 5 3 9 7 11-11 3-19 10-21 19l-4 29h60l-4-29c-2-9-10-16-21-19 4-2 7-6 7-11 0-7-5-13-12-13z",
  },
];

export function SilhouetteCarousel({
  onApply,
}: {
  onApply: (fieldName: string, formattedValue: string) => void | Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);

  function commit(direction: 1 | -1) {
    setIndex((i) =>
      Math.min(SILHOUETTES.length - 1, Math.max(0, i + direction)),
    );
    setDragX(0);
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
    if (dragX < -60 && index < SILHOUETTES.length - 1) commit(1);
    else if (dragX > 60 && index > 0) commit(-1);
    else setDragX(0);
  }

  function select() {
    const type = SILHOUETTES[index];
    if (!type) return;
    setSelected(type.name);
    void onApply("Silhouet", type.name);
  }

  const current = SILHOUETTES[index];

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="sr-only" role="status" aria-live="polite">
        {current
          ? `Showing ${current.name}, ${index + 1} of ${SILHOUETTES.length}`
          : ""}
      </p>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative h-56 w-full max-w-[220px] touch-pan-y select-none overflow-hidden lg:h-72 lg:max-w-xs"
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(calc(${-index * 100}% + ${dragging.current ? dragX : 0}px))`,
            transition: dragging.current
              ? "none"
              : "transform 350ms cubic-bezier(0.23,1,0.32,1)",
          }}
        >
          {SILHOUETTES.map((type) => (
            <div
              key={type.name}
              className="flex h-full w-full shrink-0 items-center justify-center"
            >
              <svg
                viewBox="0 0 100 90"
                className={`h-48 w-auto transition-colors duration-300 lg:h-64 ${
                  selected === type.name
                    ? "fill-[var(--color-stone-900)]"
                    : "fill-[var(--color-stone-300)]"
                }`}
                aria-hidden="true"
              >
                <path d={type.path} />
              </svg>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Previous body type"
          disabled={index === 0}
          onClick={() => commit(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-stone-300)] text-[var(--color-stone-600)] disabled:opacity-30"
        >
          ‹
        </button>
        <div className="w-40 text-center">
          <p className="font-display text-base text-[var(--color-stone-900)]">
            {current?.name}
          </p>
          <p className="text-xs text-[var(--color-stone-500)]">
            {current?.description}
          </p>
        </div>
        <button
          type="button"
          aria-label="Next body type"
          disabled={index === SILHOUETTES.length - 1}
          onClick={() => commit(1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-stone-300)] text-[var(--color-stone-600)] disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="flex gap-1.5" aria-hidden="true">
        {SILHOUETTES.map((type, i) => (
          <span
            key={type.name}
            className={`h-1.5 w-1.5 rounded-full ${
              i === index
                ? "bg-[var(--color-stone-700)]"
                : "bg-[var(--color-stone-300)]"
            }`}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={select}
        className="rounded-full bg-[var(--color-stone-900)] px-6 py-2.5 text-sm font-medium text-white active:scale-95 motion-reduce:active:scale-100"
      >
        {selected === current?.name ? "Geselecteerd" : "Selecteer silhouet"}
      </button>
    </div>
  );
}
