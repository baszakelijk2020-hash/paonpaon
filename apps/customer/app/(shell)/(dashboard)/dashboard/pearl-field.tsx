"use client";

import { type CSSProperties, useEffect, useMemo, useRef } from "react";

/**
 * Covers a surface in one continuous mother-of-pearl field derived from the
 * watch dial's palette.
 *
 * The dial itself is founder-locked and is never imported, copied, or altered
 * here. A seed changes the sweep, blooms, and interference bands so adjacent
 * selected pieces never repeat the same manufactured-looking texture.
 */

/** mulberry32 over a string hash: the same seed always lays the same copies. */
function random(seed: string) {
  let state = 0;
  for (let i = 0; i < seed.length; i++)
    state = (Math.imul(state, 31) + seed.charCodeAt(i)) | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const characters: Record<
  string,
  { cool: number; rose: number; mint: number; warm: number }
> = {
  suit: { cool: 0.88, rose: 0.38, mint: 0.52, warm: 0.3 },
  shirt: { cool: 0.4, rose: 0.84, mint: 0.5, warm: 0.42 },
  tie: { cool: 0.44, rose: 0.34, mint: 0.9, warm: 0.36 },
  loafer: { cool: 0.32, rose: 0.58, mint: 0.34, warm: 0.9 },
  "add-to-bag": { cool: 0.62, rose: 0.68, mint: 0.56, warm: 0.48 },
};

type PearlSurface = {
  angle: number;
  stopA: number;
  stopB: number;
  stopC: number;
  bloomX: number;
  bloomY: number;
  coolX: number;
  coolY: number;
  roseX: number;
  roseY: number;
  mintX: number;
  mintY: number;
  warmX: number;
  warmY: number;
  cool: number;
  rose: number;
  mint: number;
  warm: number;
};

function surface(seed: string): PearlSurface {
  const next = random(seed);
  const character = characters[seed] ?? {
    cool: 0.48 + next() * 0.3,
    rose: 0.38 + next() * 0.35,
    mint: 0.38 + next() * 0.35,
    warm: 0.38 + next() * 0.35,
  };
  return {
    angle: 112 + next() * 66,
    stopA: 27 + next() * 6,
    stopB: 49 + next() * 6,
    stopC: 69 + next() * 6,
    bloomX: 18 + next() * 64,
    bloomY: 14 + next() * 68,
    coolX: 8 + next() * 84,
    coolY: 5 + next() * 90,
    roseX: 8 + next() * 84,
    roseY: 5 + next() * 90,
    mintX: 8 + next() * 84,
    mintY: 5 + next() * 90,
    warmX: 8 + next() * 84,
    warmY: 5 + next() * 90,
    ...character,
  };
}

function initialStyle(pearl: PearlSurface): CSSProperties {
  return {
    "--pearl-angle-live": `${pearl.angle}deg`,
    "--pearl-stop-a-live": `${pearl.stopA}%`,
    "--pearl-stop-b-live": `${pearl.stopB}%`,
    "--pearl-stop-c-live": `${pearl.stopC}%`,
    "--pearl-bloom-x-live": `${pearl.bloomX}%`,
    "--pearl-bloom-y-live": `${pearl.bloomY}%`,
    "--pearl-cool-x-live": `${pearl.coolX}%`,
    "--pearl-cool-y-live": `${pearl.coolY}%`,
    "--pearl-rose-x-live": `${pearl.roseX}%`,
    "--pearl-rose-y-live": `${pearl.roseY}%`,
    "--pearl-mint-x-live": `${pearl.mintX}%`,
    "--pearl-mint-y-live": `${pearl.mintY}%`,
    "--pearl-warm-x-live": `${pearl.warmX}%`,
    "--pearl-warm-y-live": `${pearl.warmY}%`,
    "--pearl-cool-alpha": String(pearl.cool),
    "--pearl-rose-alpha": String(pearl.rose),
    "--pearl-mint-alpha": String(pearl.mint),
    "--pearl-warm-alpha": String(pearl.warm),
  } as CSSProperties;
}

export function PearlField({ seed }: { seed: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const pearl = useMemo(() => surface(seed), [seed]);
  const style = useMemo(() => initialStyle(pearl), [pearl]);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    const set = (name: string, value: number, unit: "deg" | "%") =>
      node.style.setProperty(name, `${value.toFixed(2)}${unit}`);
    const apply = () => {
      x += (targetX - x) * 0.16;
      y += (targetY - y) * 0.16;
      set("--pearl-angle-live", pearl.angle + x * 60 + y * 28, "deg");
      set("--pearl-stop-a-live", pearl.stopA + x * 18, "%");
      set("--pearl-stop-b-live", pearl.stopB + x * 18, "%");
      set("--pearl-stop-c-live", pearl.stopC + x * 18, "%");
      set("--pearl-bloom-x-live", pearl.bloomX + x * 42, "%");
      set("--pearl-bloom-y-live", pearl.bloomY + y * 42, "%");
      set("--pearl-cool-x-live", pearl.coolX - x * 26, "%");
      set("--pearl-cool-y-live", pearl.coolY + y * 18, "%");
      set("--pearl-rose-x-live", pearl.roseX + x * 30, "%");
      set("--pearl-rose-y-live", pearl.roseY - y * 22, "%");
      set("--pearl-mint-x-live", pearl.mintX - x * 28, "%");
      set("--pearl-mint-y-live", pearl.mintY - y * 24, "%");
      set("--pearl-warm-x-live", pearl.warmX + x * 20, "%");
      set("--pearl-warm-y-live", pearl.warmY + y * 26, "%");

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
  }, [pearl]);

  return (
    <span
      ref={ref}
      className="paon-pearl-field"
      style={style}
      aria-hidden="true"
    />
  );
}
