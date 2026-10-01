"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * The Tailoring Party's orbit: you in the middle, one seat per guest
 * floating around you. Reuses the orbit math from
 * wedding-parties/[id]/am-house-orbit.tsx (a port of pag1.html's `#ow`).
 *
 * An open seat shows its number in a dashed circle drawn with the same
 * 1.5px dash as the seats in the guest list beside it; a named guest shows
 * their initials, and a photo replaces the initials once there is one.
 *
 * The seats persist: a new party size fades seats in or out and glides the
 * rest to their new places, and typing a name or adding a photo only
 * repaints — the float never restarts.
 */

const ORBIT_CSS = `.tp-orbit-root {
  width: 344px;
  height: 380px;
  position: relative;
  margin: 0 auto;
  background: transparent;
  font-family: inherit;
}
.tp-orbit-root .ao {
  position: absolute;
  box-sizing: border-box;
  border-radius: 50%;
  border: 1.5px solid rgba(255,255,255,0.12);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
  background: transparent;
}
.tp-orbit-root .ao img {
  border-radius: 50%;
  object-fit: cover;
  display: block;
  width: 100%;
  height: 100%;
}
.tp-orbit-root .ao .ao-fallback {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.15);
  color: #f4f2ec;
  font-family: inherit;
  letter-spacing: 0.02em;
}
.tp-orbit-root .ao .ao-fallback svg {
  width: 40%;
  height: 40%;
  color: rgba(244,242,236,0.85);
}
.tp-orbit-root .ao.ao-empty {
  background: rgba(255,255,255,0.04);
  border: 1.5px dashed rgba(255,255,255,0.18);
}
.tp-orbit-root .ao.ao-empty .ao-fallback {
  background: transparent;
  color: rgba(244,242,236,0.5);
}
.tp-orbit-root .al {
  position: absolute;
  font-family: inherit;
  font-size: 11px;
  color: #f4f2ec;
  text-align: center;
  white-space: nowrap;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}`;

const AVATAR_ICON =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/></svg>';

/** One circle: the text (a seat number or initials), or a photo. */
export type OrbitSeat = {
  readonly text: string;
  readonly photoUrl?: string;
  /** False for a seat nobody has taken yet: dashed, number only. */
  readonly filled: boolean;
  /** Shown under the circle. */
  readonly label?: string;
};

export type OrbitCenter = {
  readonly photoUrl?: string;
  readonly label: string;
};

const CENTER_SIZE = 85;
const SEAT_SIZE = 58;

function paint(
  el: HTMLDivElement,
  size: number,
  content: {
    text?: string;
    icon?: boolean;
    photoUrl?: string;
    filled: boolean;
  },
  label?: string,
) {
  el.className = content.filled ? "ao" : "ao ao-empty";
  el.replaceChildren();
  if (content.photoUrl) {
    const img = document.createElement("img");
    img.src = content.photoUrl;
    img.width = size;
    img.height = size;
    img.alt = "";
    el.appendChild(img);
  } else {
    const fallback = document.createElement("div");
    fallback.className = "ao-fallback";
    if (content.icon) {
      fallback.innerHTML = AVATAR_ICON;
    } else {
      fallback.textContent = content.text ?? "";
      fallback.style.fontSize = `${Math.max(12, Math.round(size * 0.3))}px`;
    }
    el.appendChild(fallback);
  }
  if (label) {
    const lbl = document.createElement("div");
    lbl.className = "al";
    lbl.style.top = `${size + 10}px`;
    lbl.textContent = label;
    el.appendChild(lbl);
  }
}

type SeatNode = {
  el: HTMLDivElement;
  /** Current angle on the ring; eases toward the seat's share of it. */
  angle: number;
  phaseX: number;
  phaseY: number;
  /** 0 → 1 as a seat arrives, 1 → 0 as it leaves. */
  appear: number;
  leaving: boolean;
};

const CX = 172;
const CY = 172;
const ORBIT_R = 130;

export function TailoringPartyOrbit({
  center,
  seats,
}: {
  center: OrbitCenter;
  /** One per seat around the centre, up to seven. */
  seats: readonly OrbitSeat[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<SeatNode[]>([]);
  const count = Math.min(seats.length, 7);

  // Built once: the centre, and one frame loop that floats every seat, eases
  // each toward its place on the ring, and fades seats in and out — so a
  // change of party size moves the circles rather than rebuilding them.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.replaceChildren();
    nodesRef.current = [];

    const centerEl = document.createElement("div");
    centerEl.className = "ao";
    centerEl.style.width = `${CENTER_SIZE}px`;
    centerEl.style.height = `${CENTER_SIZE}px`;
    centerEl.style.left = `${CX - CENTER_SIZE / 2}px`;
    centerEl.style.top = `${CY - CENTER_SIZE / 2}px`;
    wrap.appendChild(centerEl);
    centerRef.current = centerEl;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let t0: number | null = null;
    let last = 0;
    let frame = 0;

    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const s = reduced ? 0 : (ts - t0) / 1000;
      const dt = Math.min(0.1, last ? (ts - last) / 1000 : 0);
      last = ts;
      const ease = reduced ? 1 : Math.min(1, dt * 5);

      // The centre drifts on its own spot, a little in both directions.
      const chx = Math.sin(s * 0.8) * 3;
      const chy = Math.sin(s * 0.65) * 5;
      centerEl.style.transform = `translate(${chx}px, ${chy}px)`;

      const active = nodesRef.current.filter((node) => !node.leaving);
      nodesRef.current = nodesRef.current.filter((node) => {
        if (node.leaving) {
          node.appear = Math.max(0, node.appear - (reduced ? 1 : dt * 4));
          if (node.appear <= 0) {
            node.el.remove();
            return false;
          }
        } else {
          const target =
            (active.indexOf(node) / Math.max(active.length, 1)) * Math.PI * 2;
          let delta = target - node.angle;
          delta = Math.atan2(Math.sin(delta), Math.cos(delta));
          node.angle += delta * ease;
          node.appear = Math.min(1, node.appear + (reduced ? 1 : dt * 4));
        }
        const a = node.angle + s * 0.035;
        const bx = CX + Math.cos(a) * ORBIT_R;
        const by = CY + Math.sin(a) * ORBIT_R;
        const hx = Math.sin(s * 0.5 + node.phaseX) * 4;
        const hy = Math.sin(s * 0.45 + node.phaseY) * 5;
        const scale = 0.6 + 0.4 * node.appear;
        node.el.style.opacity = String(node.appear);
        node.el.style.transform = `translate(${bx - SEAT_SIZE / 2 + hx}px, ${by - SEAT_SIZE / 2 + hy}px) scale(${scale})`;
        return true;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      wrap.replaceChildren();
      centerRef.current = null;
      nodesRef.current = [];
    };
  }, []);

  // A change of party size adds seats that grow in where they belong, or
  // lets the last ones fade out; the rest glide to share the ring.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const active = nodesRef.current.filter((node) => !node.leaving);
    if (count > active.length) {
      for (let i = active.length; i < count; i++) {
        const el = document.createElement("div");
        el.className = "ao ao-empty";
        el.style.width = `${SEAT_SIZE}px`;
        el.style.height = `${SEAT_SIZE}px`;
        el.style.left = "0px";
        el.style.top = "0px";
        el.style.opacity = "0";
        wrap.appendChild(el);
        nodesRef.current.push({
          el,
          angle: (i / count) * Math.PI * 2,
          phaseX: Math.random() * Math.PI * 2,
          phaseY: Math.random() * Math.PI * 2,
          appear: 0,
          leaving: false,
        });
      }
    } else if (count < active.length) {
      active.slice(count).forEach((node) => {
        node.leaving = true;
      });
    }
  }, [count]);

  // Repainted whenever a name, photo or seat changes — the float keeps going.
  useEffect(() => {
    if (centerRef.current) {
      paint(
        centerRef.current,
        CENTER_SIZE,
        {
          icon: !center.photoUrl,
          filled: true,
          ...(center.photoUrl ? { photoUrl: center.photoUrl } : {}),
        },
        center.label,
      );
    }
    nodesRef.current
      .filter((node) => !node.leaving)
      .forEach((node, i) => {
        const seat = seats[i];
        if (!seat) return;
        paint(
          node.el,
          SEAT_SIZE,
          {
            text: seat.text,
            filled: seat.filled,
            ...(seat.photoUrl ? { photoUrl: seat.photoUrl } : {}),
          },
          seat.label,
        );
      });
  }, [center, seats, count]);

  return (
    <div className="mx-auto w-full max-w-[344px]">
      {/* Scoped by a fixed class, not a generated id: a useId that differed
          between the server render and the page left the styles keyed to an
          id the element no longer had, and every circle lost its look. */}
      <style dangerouslySetInnerHTML={{ __html: ORBIT_CSS }} />
      <div className="tp-orbit-root" ref={wrapRef} style={{ minHeight: 380 }} />
    </div>
  );
}

export function TailoringPartyEntry({
  href,
  center,
  seats,
  onOpen,
}: {
  href: string;
  center: OrbitCenter;
  seats: readonly OrbitSeat[];
  /** Replaces plain navigation, e.g. to ask a guest to sign in first. */
  onOpen?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      className="appointment-tailoring-party-orbit-link"
      {...(onOpen ? { onClick: onOpen } : {})}
    >
      <TailoringPartyOrbit center={center} seats={seats} />
    </Link>
  );
}

/** "Bas Prens" → "BP"; one word gives one letter. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}
