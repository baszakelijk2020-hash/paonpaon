"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Exact port of pag1.html's `#nbs-silhouette-widget-a91k` — the FT-02
 * "Level 1 visual classification" silhouette carousel. CSS, markup, video
 * sources, panel copy (S1–S5 codes/titles) and the two "anticipated
 * FitTools" rule columns are byte-for-byte from the source, replacing the
 * previous invented Dutch-language SVG silhouettes
 * (Slank/Regulier/Atletisch/Gezet) that DESIGN_PORTS.md correctly flagged
 * as wrong. The source auto-advances through panels on a dwell timer,
 * pausing on touch/mouse interaction and resuming after a delay; each
 * panel highlights a different subset of "anticipated FitTools" rows via
 * a glowing toggle. Selection itself — recording the active silhouette as
 * a fit-tool observation — is a PAON addition (the source has no such
 * control), matching FT-02's blueprint: this is Level 1 classification
 * only, not individual analysis or prediction, which the blueprint
 * explicitly requires PAON to label unavailable rather than fabricate.
 */

interface SilhouetteItem {
  code: string;
  title: string;
  video: string;
  activeLeft: number[];
  activeRight: number[];
}

const DATA: SilhouetteItem[] = [
  {
    code: "S1",
    title: "Full Mid-Section",
    video: "https://www.nebelspiegel.com/images/vv2.mp4",
    activeLeft: [0],
    activeRight: [1],
  },
  {
    code: "S2",
    title: "Rectangular",
    video: "https://www.nebelspiegel.com/images/vv5.mp4",
    activeLeft: [],
    activeRight: [1],
  },
  {
    code: "S3",
    title: "Short Compact",
    video: "https://www.nebelspiegel.com/images/vv6.mp4",
    activeLeft: [2],
    activeRight: [4],
  },
  {
    code: "S4",
    title: "Full Robust",
    video: "https://www.nebelspiegel.com/images/vv11.mp4",
    activeLeft: [0, 3],
    activeRight: [2],
  },
  {
    code: "S5",
    title: "Slouched",
    video: "https://www.nebelspiegel.com/images/vv12.mp4",
    activeLeft: [4],
    activeRight: [0],
  },
];

const LINE_WIDTHS = {
  left: [80, 75, 70, 68, 78],
  right: [70, 75, 75, 70, 78],
};

const WIDGET_CSS = `
#nbs-silhouette-widget-a91k {
  --nbs-widget-width: 390px;
  --nbs-panel-width: 95px;
  --nbs-panel-gap: 12px;
  --nbs-card-height: 160px;
  --nbs-card-radius: 15px;
  --nbs-side-opacity: 0.4;
  --nbs-active-opacity: 1;
  --nbs-line-color: rgba(255, 255, 255, 0.3);
  --nbs-toggle-grey: #9a9a9a;
  --nbs-card-bg: #f4f4f4;
  --nbs-type-margin-top: 14px;
  --nbs-type-line-height: 10px;
  --nbs-desc-margin-top: 6px;
  --nbs-desc-line-height: 12px;
  --nbs-rules-top: 32px;
  --nbs-line-height: 4px;
  --nbs-line-gap: 11px;
  --nbs-square-size: 8px;
  --nbs-toggle-w: 20px;
  --nbs-toggle-h: 14px;
  --nbs-lines-left: 20px;
  --nbs-grid-left: 40px;
  --nbs-grid-right: 40px;
  --nbs-grid-col-gap: 24px;
  --nbs-glow-spread: 10px;
  --nbs-glow-blur: 8px;
}
@font-face {
  font-family: 'nbs-gtbold3';
  src: url('/fonts/Munged-teVV8iw7A5.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}
@font-face {
  font-family: 'nbs-optima';
  src: url('/fonts/TN_Web_Use_Only_2.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
#nbs-silhouette-widget-a91k,
#nbs-silhouette-widget-a91k * { box-sizing: border-box; }
#nbs-silhouette-widget-a91k {
  width: var(--nbs-widget-width);
  overflow: hidden;
  position: relative;
  background: linear-gradient(to bottom, #808080, #000000);
  padding-top: 20px;
  padding-bottom: 20px;
}
#nbs-silhouette-carousel-a91k {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  scroll-snap-type: x mandatory;
}
#nbs-silhouette-carousel-a91k::-webkit-scrollbar { display: none; }
#nbs-silhouette-carousel-a91k .nbs-track-a91k {
  display: flex;
  width: max-content;
  gap: var(--nbs-panel-gap);
  padding-left: calc((var(--nbs-widget-width) / 2) - (var(--nbs-panel-width) / 2));
  padding-right: calc((var(--nbs-widget-width) / 2) - (var(--nbs-panel-width) / 2));
}
#nbs-silhouette-carousel-a91k .nbs-panel-a91k {
  flex: 0 0 var(--nbs-panel-width);
  width: var(--nbs-panel-width);
  scroll-snap-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: var(--nbs-side-opacity);
  transition: opacity 180ms linear;
}
#nbs-silhouette-carousel-a91k .nbs-panel-a91k.is-active-a91k {
  opacity: var(--nbs-active-opacity);
}
#nbs-silhouette-carousel-a91k .nbs-card-a91k {
  width: var(--nbs-panel-width);
  height: var(--nbs-card-height);
  border-radius: var(--nbs-card-radius);
  overflow: hidden;
  background: var(--nbs-card-bg);
  position: relative;
}
#nbs-silhouette-carousel-a91k .nbs-video-a91k {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: transparent;
}
#nbs-silhouette-carousel-a91k .nbs-type-a91k {
  width: 100%;
  margin-top: var(--nbs-type-margin-top);
  text-align: center;
  font-family: 'nbs-gtbold3', sans-serif;
  font-size: 7px;
  line-height: var(--nbs-type-line-height);
  text-transform: uppercase;
  color: #ffffff;
  letter-spacing: 0;
}
#nbs-silhouette-carousel-a91k .nbs-desc-a91k {
  width: 100%;
  margin-top: var(--nbs-desc-margin-top);
  text-align: center;
  font-family: 'nbs-optima', sans-serif;
  font-size: 10px;
  line-height: var(--nbs-desc-line-height);
  text-transform: capitalize;
  color: #ffffff;
}
#nbs-fixed-rules-a91k {
  width: 100%;
  margin-top: var(--nbs-rules-top);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  column-gap: var(--nbs-grid-col-gap);
  padding-left: var(--nbs-grid-left);
  padding-right: var(--nbs-grid-right);
  align-items: start;
}
#nbs-fixed-rules-a91k .nbs-rule-col-a91k {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}
#nbs-fixed-rules-a91k .nbs-rule-row-a91k {
  width: 100%;
  display: grid;
  grid-template-columns: var(--nbs-square-size) minmax(0, 1fr) var(--nbs-toggle-w);
  column-gap: 12px;
  align-items: center;
  height: var(--nbs-square-size);
  margin-top: var(--nbs-line-gap);
}
#nbs-fixed-rules-a91k .nbs-rule-row-a91k:first-child { margin-top: 0; }
#nbs-fixed-rules-a91k .nbs-rule-col-a91k > .nbs-rule-row-a91k:last-child { margin-bottom: 10px; }
#nbs-fixed-rules-a91k .nbs-square-a91k {
  width: var(--nbs-square-size);
  height: var(--nbs-square-size);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
  opacity: 1;
  flex-shrink: 0;
  transition: background-color 220ms linear, box-shadow 220ms linear;
}
#nbs-fixed-rules-a91k .nbs-square-a91k.nbs-is-on-a91k {
  background: #ffffff;
  box-shadow: 0 0 var(--nbs-glow-blur) var(--nbs-glow-spread) rgba(255, 255, 255, 0.18),
              0 0 var(--nbs-glow-blur) 4px rgba(255, 255, 255, 0.5);
}
#nbs-fixed-rules-a91k .nbs-bar-wrap-a91k {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  height: var(--nbs-square-size);
  padding-left: calc(20px - var(--nbs-lines-left));
  padding-right: 20px;
}
#nbs-fixed-rules-a91k .nbs-bar-a91k {
  height: var(--nbs-line-height);
  border-radius: 999px;
  background: var(--nbs-line-color);
  flex: 0 0 auto;
}
#nbs-fixed-rules-a91k .nbs-toggle-a91k {
  width: var(--nbs-toggle-w);
  height: var(--nbs-toggle-h);
  border-radius: 5px;
  overflow: hidden;
  background: linear-gradient(to right, #ffffff 0%, #ffffff 68%, var(--nbs-toggle-grey) 68%, var(--nbs-toggle-grey) 100%);
}
`;

const SLIDE_MS = 600;
const DWELL_MS = 3143;
const RESUME_DELAY = 2000;

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function SilhouetteWidget({
  onApply,
}: {
  onApply: (fieldName: string, formattedValue: string) => void | Promise<void>;
}) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndexState] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const panels = Array.from(
      carousel.querySelectorAll<HTMLDivElement>(".nbs-panel-a91k"),
    );
    const videos = Array.from(
      carousel.querySelectorAll<HTMLVideoElement>(".nbs-video-a91k"),
    );

    function tryPlay(v: HTMLVideoElement) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
    videos.forEach((v) => {
      if (v.readyState >= 2) tryPlay(v);
      else {
        v.addEventListener("loadeddata", () => tryPlay(v), { once: true });
        v.addEventListener("canplay", () => tryPlay(v), { once: true });
      }
    });

    let rafId: number | null = null;
    let slideRaf: number | null = null;
    let isAutoScrolling = false;

    function setActive(idx: number) {
      activeIndexRef.current = idx;
      setActiveIndexState(idx);
      panels.forEach((p, i) => p.classList.toggle("is-active-a91k", i === idx));
    }

    function getPanelScrollTarget(index: number): number {
      const panel = panels[index];
      if (!panel || !carousel) return 0;
      return (
        panel.offsetLeft + panel.offsetWidth / 2 - carousel.clientWidth / 2
      );
    }

    function updateActivePanel() {
      if (isAutoScrolling || !carousel) return;
      const carouselRect = carousel.getBoundingClientRect();
      const centerX = carouselRect.left + carouselRect.width / 2;
      let nearestDist = Infinity;
      let nearestIndex = 0;
      panels.forEach((panel, i) => {
        const rect = panel.getBoundingClientRect();
        const pCenter = rect.left + rect.width / 2;
        const dist = Math.abs(centerX - pCenter);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIndex = i;
        }
      });
      if (nearestIndex !== activeIndexRef.current) setActive(nearestIndex);
    }

    function requestActiveUpdate() {
      if (isAutoScrolling) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateActivePanel);
    }

    carousel.addEventListener("scroll", requestActiveUpdate, {
      passive: true,
    });
    window.addEventListener("resize", requestActiveUpdate);

    let autoActive = false;
    let autoTimer: ReturnType<typeof setTimeout> | null = null;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let userInteracting = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDirectionLocked = false;

    function scrollToPanel(index: number) {
      if (!carousel) return;
      if (slideRaf) cancelAnimationFrame(slideRaf);
      isAutoScrolling = true;
      setActive(index);
      carousel.style.scrollSnapType = "none";
      const target = getPanelScrollTarget(index);
      const start = carousel.scrollLeft;
      const delta = target - start;
      const startTime = performance.now();

      function step(now: number) {
        if (!carousel) return;
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / SLIDE_MS, 1);
        carousel.scrollLeft = start + delta * ease(progress);
        if (progress < 1) {
          slideRaf = requestAnimationFrame(step);
        } else {
          carousel.scrollLeft = target;
          carousel.style.scrollSnapType = "x mandatory";
          isAutoScrolling = false;
          slideRaf = null;
          if (autoActive && !userInteracting) {
            autoTimer = setTimeout(advanceAuto, DWELL_MS);
          }
        }
      }
      slideRaf = requestAnimationFrame(step);
    }

    function advanceAuto() {
      if (!autoActive || userInteracting) return;
      const next = (activeIndexRef.current + 1) % panels.length;
      scrollToPanel(next);
    }

    function startAuto() {
      if (autoActive) return;
      autoActive = true;
      autoTimer = setTimeout(advanceAuto, DWELL_MS);
    }

    function stopAuto() {
      autoActive = false;
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
      if (slideRaf) {
        cancelAnimationFrame(slideRaf);
        slideRaf = null;
      }
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
      isAutoScrolling = false;
      if (carousel) carousel.style.scrollSnapType = "x mandatory";
    }

    function onHorizontalInteractStart() {
      userInteracting = true;
      stopAuto();
    }

    function onHorizontalInteractEnd() {
      userInteracting = false;
      let lastPos = carousel?.scrollLeft ?? 0;
      function waitForSettle() {
        if (!carousel) return;
        const current = carousel.scrollLeft;
        if (Math.abs(current - lastPos) < 1) {
          resumeTimer = setTimeout(() => {
            if (!userInteracting) startAuto();
          }, RESUME_DELAY);
        } else {
          lastPos = current;
          settleTimer = setTimeout(waitForSettle, 80);
        }
      }
      settleTimer = setTimeout(waitForSettle, 80);
    }

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchDirectionLocked = false;
    }
    function onTouchMove(e: TouchEvent) {
      if (touchDirectionLocked) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - touchStartX);
      const dy = Math.abs(touch.clientY - touchStartY);
      if (dx > 5 || dy > 5) {
        touchDirectionLocked = true;
        if (dx > dy) onHorizontalInteractStart();
      }
    }
    function onTouchEnd() {
      if (userInteracting) onHorizontalInteractEnd();
    }
    function onMouseLeave() {
      if (userInteracting) onHorizontalInteractEnd();
    }

    carousel.addEventListener("touchstart", onTouchStart, { passive: true });
    carousel.addEventListener("touchmove", onTouchMove, { passive: true });
    carousel.addEventListener("touchend", onTouchEnd, { passive: true });
    carousel.addEventListener("touchcancel", onTouchEnd, { passive: true });
    carousel.addEventListener("mousedown", onHorizontalInteractStart);
    carousel.addEventListener("mouseup", onHorizontalInteractEnd);
    carousel.addEventListener("mouseleave", onMouseLeave);

    setActive(0);
    const initialRaf = requestAnimationFrame(() => {
      updateActivePanel();
      startAuto();
    });

    return () => {
      cancelAnimationFrame(initialRaf);
      if (rafId) cancelAnimationFrame(rafId);
      stopAuto();
      carousel.removeEventListener("scroll", requestActiveUpdate);
      window.removeEventListener("resize", requestActiveUpdate);
      carousel.removeEventListener("touchstart", onTouchStart);
      carousel.removeEventListener("touchmove", onTouchMove);
      carousel.removeEventListener("touchend", onTouchEnd);
      carousel.removeEventListener("touchcancel", onTouchEnd);
      carousel.removeEventListener("mousedown", onHorizontalInteractStart);
      carousel.removeEventListener("mouseup", onHorizontalInteractEnd);
      carousel.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  const active = DATA[activeIndex];
  const activeLeftSet = new Set(active?.activeLeft ?? []);
  const activeRightSet = new Set(active?.activeRight ?? []);

  function handleSelect() {
    if (!active) return;
    setSelected(active.code);
    void onApply("Silhouette", `${active.code} — ${active.title}`);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="sr-only" role="status" aria-live="polite">
        {active
          ? `Showing ${active.code} ${active.title}, ${activeIndex + 1} of ${DATA.length}`
          : ""}
      </p>
      <div id="nbs-silhouette-widget-a91k">
        <style>{WIDGET_CSS}</style>
        <div id="nbs-silhouette-carousel-a91k" ref={carouselRef}>
          <div className="nbs-track-a91k" id="nbs-track-a91k">
            {DATA.map((item, i) => (
              <div
                className={`nbs-panel-a91k${i === activeIndex ? "is-active-a91k" : ""}`}
                key={item.code}
              >
                <div className="nbs-card-a91k">
                  <video
                    className="nbs-video-a91k"
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                  >
                    <source src={item.video} type="video/mp4" />
                  </video>
                </div>
                <div className="nbs-type-a91k">{item.code}</div>
                <div className="nbs-desc-a91k">{item.title}</div>
              </div>
            ))}
          </div>
        </div>
        <div id="nbs-fixed-rules-a91k">
          <div className="nbs-rule-col-a91k">
            {LINE_WIDTHS.left.map((width, i) => (
              <div className="nbs-rule-row-a91k" key={i}>
                <div
                  className={`nbs-square-a91k${activeLeftSet.has(i) ? "nbs-is-on-a91k" : ""}`}
                />
                <div className="nbs-bar-wrap-a91k">
                  <div className="nbs-bar-a91k" style={{ width }} />
                </div>
                <div className="nbs-toggle-a91k" />
              </div>
            ))}
          </div>
          <div className="nbs-rule-col-a91k">
            {LINE_WIDTHS.right.map((width, i) => (
              <div className="nbs-rule-row-a91k" key={i}>
                <div
                  className={`nbs-square-a91k${activeRightSet.has(i) ? "nbs-is-on-a91k" : ""}`}
                />
                <div className="nbs-bar-wrap-a91k">
                  <div className="nbs-bar-a91k" style={{ width }} />
                </div>
                <div className="nbs-toggle-a91k" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSelect}
        className="rounded-full bg-[var(--color-stone-900)] px-6 py-2.5 text-sm font-medium text-white active:scale-95 motion-reduce:active:scale-100"
      >
        {selected === active?.code
          ? "Selected"
          : `Select ${active?.code ?? ""}`}
      </button>
    </div>
  );
}
