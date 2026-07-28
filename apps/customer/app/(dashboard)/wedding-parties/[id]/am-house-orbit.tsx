"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Exact port of pag1.html `#ow` — AM House Party orbit (u569374 / #ow).
 * CSS and animation math are byte-for-byte from the source. The only
 * intentional change is the data hook: center + orbiters come from
 * WeddingPartyMember rows (photoUrl + name) instead of hardcoded
 * avaN.png / Tom/Erik/… names.
 */

const ORBIT_CSS = `#ow-root {
  width: 344px;
  height: 380px;
  position: relative;
  margin: 0 auto;
  background: transparent;
}
#ow-root .ao {
  position: absolute;
  border-radius: 50%;
  border: 3px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
  background: transparent;
}
#ow-root .ao img {
  border-radius: 50%;
  object-fit: cover;
  display: block;
  width: 100%;
  height: 100%;
}
#ow-root .ao .ao-fallback {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.15);
  color: #ffffff;
  font-family: 'Optimaklein', OptimaKlein, sans-serif;
  font-size: 18px;
}
#ow-root .al {
  position: absolute;
  font-family: 'Optimaklein', OptimaKlein, sans-serif;
  font-size: 11px;
  color: #ffffff;
  text-align: center;
  white-space: nowrap;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}`;

export type OrbitPerson = {
  name: string;
  photoUrl?: string;
};

export function AmHouseOrbit({
  center,
  orbiters,
}: {
  center: OrbitPerson;
  orbiters: OrbitPerson[];
}) {
  const reactId = useId().replace(/:/g, "");
  const rootId = `ow-${reactId}`;
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    wrap.replaceChildren();

    const cx = 172;
    const cy = 172;
    const orbitR = 130;

    function make(size: number, name: string, photoUrl?: string) {
      const d = document.createElement("div");
      d.className = "ao";
      d.style.width = `${size}px`;
      d.style.height = `${size}px`;
      d.style.left = "0px";
      d.style.top = "0px";
      if (photoUrl) {
        const i = document.createElement("img");
        i.src = photoUrl;
        i.width = size;
        i.height = size;
        i.alt = "";
        d.appendChild(i);
      } else {
        const fallback = document.createElement("div");
        fallback.className = "ao-fallback";
        fallback.textContent = (name.charAt(0) || "?").toUpperCase();
        fallback.style.fontSize = `${Math.max(12, Math.round(size * 0.32))}px`;
        d.appendChild(fallback);
      }
      if (name) {
        const lbl = document.createElement("div");
        lbl.className = "al";
        lbl.style.top = `${size + 10}px`;
        lbl.textContent = name;
        d.appendChild(lbl);
      }
      return d;
    }

    const centerEl = make(85, center.name, center.photoUrl);
    centerEl.style.left = `${cx - 42.5}px`;
    centerEl.style.top = `${cy - 42.5}px`;
    wrap.appendChild(centerEl);

    const ring = orbiters.slice(0, 5);
    const nodes = ring.map((person, i) => {
      const el = make(58, person.name, person.photoUrl);
      wrap.appendChild(el);
      return {
        el,
        baseAngle: (i / Math.max(ring.length, 1)) * Math.PI * 2,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
      };
    });

    let t0: number | null = null;
    let frame = 0;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const s = (ts - t0) / 1000;
      const ch = Math.sin(s * 0.4) * 5;
      centerEl.style.transform = `translate(0px, ${ch}px)`;
      nodes.forEach(({ el, baseAngle, phaseX, phaseY }) => {
        const a = baseAngle + s * 0.035;
        const bx = cx + Math.cos(a) * orbitR;
        const by = cy + Math.sin(a) * orbitR;
        const hx = Math.sin(s * 0.5 + phaseX) * 4;
        const hy = Math.sin(s * 0.45 + phaseY) * 5;
        el.style.transform = `translate(${bx - 29 + hx}px, ${by - 29 + hy}px)`;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      wrap.replaceChildren();
    };
  }, [center, orbiters]);

  return (
    <div className="mx-auto w-full max-w-[344px]">
      <p className="mb-3 text-center font-[OptimaKlein,Optimaklein,sans-serif] text-sm text-[var(--color-stone-900)]">
        AM House Party
      </p>
      <div
        className="rounded-[24px] bg-[linear-gradient(180deg,#2a2925_0%,#111110_100%)] px-0 py-4"
        style={{ minHeight: 380 }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: ORBIT_CSS.replace(/#ow-root/g, `#${rootId}`),
          }}
        />
        <div id={rootId} ref={wrapRef} />
      </div>
    </div>
  );
}
